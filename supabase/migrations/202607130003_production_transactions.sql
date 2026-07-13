-- Phase 3: production employee sessions and atomic time-clock transactions.
begin;

alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.employees enable row level security;
create policy companies_member_read on public.companies for select using(public.is_company_member(id));
create policy company_users_manager_read on public.company_users for select using(public.is_company_manager(company_id));
create policy employees_manager_read on public.employees for select using(public.is_company_manager(company_id));
create policy employees_manager_update on public.employees for update using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
alter table public.employee_sessions add constraint employee_sessions_token_hash_hex check(token_hash ~ '^[a-f0-9]{64}$');

create or replace function public.employee_login_candidate(p_company_code text, p_employee_number text)
returns table(employee_id uuid, company_id uuid, pin_hash text, pin_locked boolean)
language sql security definer set search_path=public as $$
  select e.id,e.company_id,e.pin_hash,(e.pin_locked_until is not null and e.pin_locked_until > clock_timestamp())
  from public.employees e join public.companies c on c.id=e.company_id
  where lower(c.code)=lower(trim(p_company_code)) and e.employee_number=trim(p_employee_number) and e.status='ACTIVE'
  limit 1
$$;
revoke all on function public.employee_login_candidate(text,text) from public,anon,authenticated;
grant execute on function public.employee_login_candidate(text,text) to service_role;

create or replace function public.record_employee_login_attempt(p_employee_id uuid,p_success boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_employee public.employees; v_now timestamptz:=clock_timestamp(); v_attempts integer;
begin
  select * into v_employee from public.employees where id=p_employee_id for update;
  if v_employee.id is null then return jsonb_build_object('locked',true); end if;
  if p_success and (v_employee.pin_locked_until is null or v_employee.pin_locked_until<=v_now) then
    update public.employees set failed_pin_attempts=0,pin_locked_until=null,updated_at=v_now where id=p_employee_id;
    return jsonb_build_object('locked',false);
  end if;
  v_attempts:=v_employee.failed_pin_attempts+1;
  update public.employees set failed_pin_attempts=v_attempts,
    pin_locked_until=case when v_attempts>=5 then v_now+interval '15 minutes' else pin_locked_until end,updated_at=v_now
  where id=p_employee_id;
  return jsonb_build_object('locked',v_attempts>=5);
end $$;
revoke all on function public.record_employee_login_attempt(uuid,boolean) from public,anon,authenticated;
grant execute on function public.record_employee_login_attempt(uuid,boolean) to service_role;

create or replace function public.create_employee_session(p_employee_id uuid,p_token_hash text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_employee public.employees; v_id uuid;
begin
  select * into v_employee from public.employees where id=p_employee_id and status='ACTIVE';
  if v_employee.id is null or p_expires_at<=clock_timestamp() then raise exception 'Invalid employee session request'; end if;
  insert into public.employee_sessions(company_id,employee_id,token_hash,expires_at)
  values(v_employee.company_id,v_employee.id,p_token_hash,p_expires_at) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_employee_session(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_employee_session(uuid,text,timestamptz) to service_role;

create or replace function public.resolve_employee_session(p_token_hash text)
returns table(employee_id uuid,company_id uuid,preferred_name text)
language plpgsql security definer set search_path=public as $$
begin
  update public.employee_sessions s set last_activity_at=clock_timestamp()
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>clock_timestamp();
  return query select e.id,e.company_id,e.preferred_name from public.employee_sessions s
  join public.employees e on e.id=s.employee_id and e.company_id=s.company_id
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>clock_timestamp() and e.status='ACTIVE';
end $$;
revoke all on function public.resolve_employee_session(text) from public,anon,authenticated;
grant execute on function public.resolve_employee_session(text) to service_role;

create or replace function public.revoke_employee_session(p_token_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.employee_sessions set revoked_at=coalesce(revoked_at,clock_timestamp()) where token_hash=p_token_hash;
  return found;
end $$;
revoke all on function public.revoke_employee_session(text) from public,anon,authenticated;
grant execute on function public.revoke_employee_session(text) to service_role;

create or replace function public.employee_clock_action(
  p_token_hash text,p_action text,p_worksite_id uuid,p_idempotency_key uuid,
  p_client_timestamp timestamptz default null,p_latitude numeric default null,p_longitude numeric default null,
  p_accuracy_meters numeric default null,p_permission_status text default 'NOT_REQUESTED',
  p_source public.time_event_source default 'EMPLOYEE_WEB',p_device_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp(); v_employee public.employees; v_session public.employee_sessions; v_worksite public.worksites;
  v_entry public.time_entries; v_break public.break_entries; v_distance numeric; v_inside boolean; v_verification text; v_review boolean:=false;
  v_need_location boolean; v_elapsed integer; v_unpaid integer; v_all_breaks integer; v_event public.time_events; v_existing public.time_events;
begin
  if p_action not in ('CLOCK_IN','CLOCK_OUT','BREAK_START','BREAK_END') then raise exception 'Unsupported time clock action'; end if;
  if p_permission_status not in ('GRANTED','DENIED','UNAVAILABLE','NOT_REQUESTED') then raise exception 'Invalid location permission status'; end if;
  select * into v_session from public.employee_sessions where token_hash=p_token_hash for update;
  if v_session.id is null or v_session.revoked_at is not null or v_session.expires_at<=v_now then raise exception 'Employee session expired'; end if;
  select * into v_employee from public.employees where id=v_session.employee_id and company_id=v_session.company_id for update;
  if v_employee.id is null or v_employee.status<>'ACTIVE' then raise exception 'Employee is inactive'; end if;
  update public.employee_sessions set last_activity_at=v_now where id=v_session.id;

  select * into v_existing from public.time_events where employee_id=v_employee.id and idempotency_key=p_idempotency_key;
  if v_existing.id is not null then return jsonb_build_object('event_id',v_existing.id,'duplicate',true,'server_timestamp',v_existing.server_timestamp); end if;

  select w.* into v_worksite from public.worksites w join public.employee_worksites ew
    on ew.worksite_id=w.id and ew.employee_id=v_employee.id and ew.company_id=v_employee.company_id and ew.status='ACTIVE'
    where w.id=p_worksite_id and w.company_id=v_employee.company_id and w.status='ACTIVE';
  if v_worksite.id is null then raise exception 'Worksite is not assigned to employee'; end if;
  select * into v_entry from public.time_entries where employee_id=v_employee.id and company_id=v_employee.company_id and status='OPEN' for update;

  if p_action='CLOCK_IN' and v_entry.id is not null then raise exception 'Employee is already clocked in'; end if;
  if p_action<>'CLOCK_IN' and v_entry.id is null then raise exception 'No open time entry'; end if;
  if v_entry.id is not null then select * into v_break from public.break_entries where time_entry_id=v_entry.id and status='OPEN' for update; end if;
  if p_action='BREAK_START' and v_break.id is not null then raise exception 'Break is already active'; end if;
  if p_action='BREAK_END' and v_break.id is null then raise exception 'No active break'; end if;
  if p_action='CLOCK_OUT' and v_break.id is not null then raise exception 'End break before clocking out'; end if;

  v_need_location:=v_worksite.require_location and (p_action in ('CLOCK_IN','CLOCK_OUT') or v_worksite.capture_break_location);
  if not v_need_location or v_worksite.location_mode='OPTIONAL' then v_verification:='NOT_REQUIRED'; v_inside:=null;
  elsif p_permission_status<>'GRANTED' or p_latitude is null or p_longitude is null then
    v_verification:='MISSING'; v_inside:=null;
    if v_worksite.location_mode='STRICT' then raise exception 'Location verification is required'; else v_review:=true; end if;
  elsif v_worksite.latitude is null or v_worksite.longitude is null then
    v_verification:='MISSING'; v_inside:=null;
    if v_worksite.location_mode='STRICT' then raise exception 'Worksite coordinates are not configured'; else v_review:=true; end if;
  else
    v_distance:=public.haversine_meters(p_latitude,p_longitude,v_worksite.latitude,v_worksite.longitude);
    v_inside:=v_distance<=v_worksite.geofence_radius_meters; v_verification:=case when v_inside then 'VERIFIED' else 'OUTSIDE' end;
    if not v_inside and v_worksite.location_mode='STRICT' then raise exception 'Employee is outside the worksite geofence'; end if;
    v_review:=not v_inside and v_worksite.location_mode='FLAG';
  end if;

  if p_action='CLOCK_IN' then
    insert into public.time_entries(company_id,employee_id,worksite_id,clock_in_at,status,approval_status)
    values(v_employee.company_id,v_employee.id,v_worksite.id,v_now,'OPEN',case when v_review then 'NEEDS_REVIEW' else 'PENDING' end) returning * into v_entry;
  elsif p_action='BREAK_START' then
    insert into public.break_entries(company_id,employee_id,time_entry_id,break_type,started_at,status)
    values(v_employee.company_id,v_employee.id,v_entry.id,'UNPAID',v_now,'OPEN') returning * into v_break;
  elsif p_action='BREAK_END' then
    update public.break_entries set ended_at=v_now,status='COMPLETED',updated_at=v_now where id=v_break.id returning * into v_break;
  elsif p_action='CLOCK_OUT' then
    select coalesce(sum(floor(extract(epoch from (ended_at-started_at))/60)),0)::integer,
      coalesce(sum(case when break_type='UNPAID' then floor(extract(epoch from (ended_at-started_at))/60) else 0 end),0)::integer
      into v_all_breaks,v_unpaid from public.break_entries where time_entry_id=v_entry.id and status='COMPLETED';
    v_elapsed:=greatest(0,floor(extract(epoch from (v_now-v_entry.clock_in_at))/60)::integer);
    update public.time_entries set clock_out_at=v_now,status='COMPLETED',total_break_minutes=v_all_breaks,
      total_work_minutes=greatest(0,v_elapsed-v_unpaid),regular_minutes=greatest(0,v_elapsed-v_unpaid),overtime_minutes=0,
      approval_status=case when v_review or approval_status='NEEDS_REVIEW' or exists(select 1 from public.time_events where time_entry_id=v_entry.id and location_verification_result in ('MISSING','OUTSIDE')) then 'NEEDS_REVIEW' else 'PENDING' end,
      updated_at=v_now where id=v_entry.id returning * into v_entry;
  end if;

  insert into public.time_events(company_id,employee_id,time_entry_id,break_entry_id,worksite_id,event_type,server_timestamp,
    client_timestamp,latitude,longitude,location_accuracy_meters,distance_from_worksite_meters,geofence_radius_meters,inside_geofence,
    location_permission_status,location_verification_result,source,device_metadata,idempotency_key)
  values(v_employee.company_id,v_employee.id,v_entry.id,case when p_action like 'BREAK_%' then v_break.id else null end,v_worksite.id,p_action::public.time_event_type,v_now,
    p_client_timestamp,p_latitude,p_longitude,p_accuracy_meters,v_distance,v_worksite.geofence_radius_meters,v_inside,
    p_permission_status,v_verification,p_source,coalesce(p_device_metadata,'{}'::jsonb),p_idempotency_key)
    returning * into v_event;
  return jsonb_build_object('duplicate',false,'event_id',v_event.id,'time_entry_id',v_entry.id,'server_timestamp',v_now,'state',
    case when p_action='CLOCK_OUT' then 'OFF_CLOCK' when p_action='BREAK_START' then 'ON_BREAK' else 'CLOCKED_IN' end);
exception when unique_violation then
  select * into v_event from public.time_events where employee_id=v_employee.id and idempotency_key=p_idempotency_key;
  if v_event.id is not null then return jsonb_build_object('duplicate',true,'event_id',v_event.id,'time_entry_id',v_event.time_entry_id); end if;
  raise;
end $$;
revoke all on function public.employee_clock_action(text,text,uuid,uuid,timestamptz,numeric,numeric,numeric,text,public.time_event_source,jsonb) from public,anon,authenticated;
grant execute on function public.employee_clock_action(text,text,uuid,uuid,timestamptz,numeric,numeric,numeric,text,public.time_event_source,jsonb) to service_role;

create or replace function public.manager_edit_time_entry(p_entry_id uuid,p_clock_in_at timestamptz,p_clock_out_at timestamptz,p_breaks jsonb,p_reason text)
returns public.time_entries language plpgsql security definer set search_path=public as $$
declare v_entry public.time_entries; v_original jsonb; v_now timestamptz:=clock_timestamp(); v_elapsed integer; v_unpaid integer; v_total integer;
begin
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_entry from public.time_entries where id=p_entry_id for update;
  if v_entry.id is null or not public.is_company_manager(v_entry.company_id) then raise exception 'NOT_AUTHORIZED'; end if;
  v_original:=jsonb_build_object('time_entry',to_jsonb(v_entry),'breaks',coalesce((select jsonb_agg(to_jsonb(b)) from public.break_entries b where b.time_entry_id=v_entry.id),'[]'::jsonb));
  if p_clock_in_at is not null then v_entry.clock_in_at:=p_clock_in_at; end if;
  if p_clock_out_at is not null then v_entry.clock_out_at:=p_clock_out_at; end if;
  if v_entry.clock_out_at is null or v_entry.clock_out_at<v_entry.clock_in_at then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_breaks is not null then
    update public.break_entries set status='VOIDED',updated_at=v_now where time_entry_id=v_entry.id and status<>'VOIDED';
    insert into public.break_entries(company_id,employee_id,time_entry_id,break_type,started_at,ended_at,status)
      select v_entry.company_id,v_entry.employee_id,v_entry.id,(x->>'type')::public.break_type,(x->>'startedAt')::timestamptz,(x->>'endedAt')::timestamptz,'COMPLETED'
      from jsonb_array_elements(p_breaks) x;
  end if;
  select coalesce(sum(floor(extract(epoch from (ended_at-started_at))/60)),0)::integer,
    coalesce(sum(case when break_type='UNPAID' then floor(extract(epoch from (ended_at-started_at))/60) else 0 end),0)::integer
    into v_total,v_unpaid from public.break_entries where time_entry_id=v_entry.id and status='COMPLETED';
  v_elapsed:=floor(extract(epoch from (v_entry.clock_out_at-v_entry.clock_in_at))/60)::integer;
  update public.time_entries set clock_in_at=v_entry.clock_in_at,clock_out_at=v_entry.clock_out_at,total_break_minutes=v_total,
    total_work_minutes=greatest(0,v_elapsed-v_unpaid),regular_minutes=greatest(0,v_elapsed-v_unpaid),approval_status='NEEDS_REVIEW',
    approved_by=null,approved_at=null,updated_at=v_now where id=v_entry.id returning * into v_entry;
  insert into public.time_events(company_id,employee_id,time_entry_id,worksite_id,event_type,server_timestamp,location_permission_status,location_verification_result,source,idempotency_key,actor_user_id,reason,original_values)
    values(v_entry.company_id,v_entry.employee_id,v_entry.id,v_entry.worksite_id,'MANAGER_EDIT',v_now,'NOT_REQUESTED','NOT_REQUIRED','ADMIN',gen_random_uuid(),auth.uid(),p_reason,v_original);
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,reason,original_values,new_values)
    values(v_entry.company_id,auth.uid(),'TIMESHEET_EDIT','time_entry',v_entry.id,p_reason,v_original,to_jsonb(v_entry));
  return v_entry;
end $$;
revoke all on function public.manager_edit_time_entry(uuid,timestamptz,timestamptz,jsonb,text) from public;
grant execute on function public.manager_edit_time_entry(uuid,timestamptz,timestamptz,jsonb,text) to authenticated;

create or replace function public.review_time_off_request(p_request_id uuid,p_decision text,p_note text)
returns public.time_off_requests language plpgsql security definer set search_path=public as $$
declare v_request public.time_off_requests; v_now timestamptz:=clock_timestamp();
begin
  if p_decision not in ('APPROVED','DENIED') then raise exception 'INVALID_DECISION'; end if;
  select * into v_request from public.time_off_requests where id=p_request_id for update;
  if v_request.id is null or not public.is_company_manager(v_request.company_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_request.status<>'PENDING' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  update public.time_off_requests set status=p_decision::public.time_off_status,manager_note=p_note,reviewed_by=auth.uid(),reviewed_at=v_now,updated_at=v_now where id=v_request.id returning * into v_request;
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,reason,new_values)
    values(v_request.company_id,auth.uid(),'TIME_OFF_REVIEW','time_off_request',v_request.id,p_note,jsonb_build_object('status',p_decision));
  return v_request;
end $$;
revoke all on function public.review_time_off_request(uuid,text,text) from public;
grant execute on function public.review_time_off_request(uuid,text,text) to authenticated;

-- Server-side service operations still carry explicit tenant predicates. Service-role is not exposed to clients.
grant select,insert,update on public.employee_sessions,public.employees,public.employee_worksites,public.worksites,public.time_entries,public.break_entries,public.time_events,public.time_correction_requests,public.time_off_requests,public.companies to service_role;
commit;
