-- Transactional manager approval and audited edit primitives.
begin;
create or replace function public.approve_time_entry(p_entry_id uuid, p_approved boolean, p_note text default null)
returns public.time_entries language plpgsql security definer set search_path=public as $$
declare v_entry public.time_entries; v_status public.approval_status; v_now timestamptz := clock_timestamp();
begin
  select * into v_entry from public.time_entries where id=p_entry_id for update;
  if v_entry.id is null or not public.is_company_manager(v_entry.company_id) then raise exception 'Not authorized'; end if;
  if v_entry.status <> 'COMPLETED' then raise exception 'Only completed entries can be reviewed'; end if;
  v_status := case when p_approved then 'APPROVED'::public.approval_status else 'REJECTED'::public.approval_status end;
  update public.time_entries set approval_status=v_status,manager_note=p_note,approved_by=auth.uid(),approved_at=v_now,updated_at=v_now where id=p_entry_id returning * into v_entry;
  insert into public.time_events(company_id,employee_id,time_entry_id,worksite_id,event_type,server_timestamp,location_permission_status,location_verification_result,source,idempotency_key,actor_user_id,reason)
  values(v_entry.company_id,v_entry.employee_id,v_entry.id,v_entry.worksite_id,'MANAGER_APPROVAL',v_now,'NOT_REQUESTED','NOT_REQUIRED','ADMIN',gen_random_uuid(),auth.uid(),p_note);
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,reason,new_values)
  values(v_entry.company_id,auth.uid(),'TIMESHEET_REVIEW','time_entry',v_entry.id,p_note,jsonb_build_object('approval_status',v_status));
  return v_entry;
end $$;
revoke all on function public.approve_time_entry(uuid,boolean,text) from public;
grant execute on function public.approve_time_entry(uuid,boolean,text) to authenticated;

create or replace function public.haversine_meters(lat1 numeric,lon1 numeric,lat2 numeric,lon2 numeric) returns numeric
language sql immutable strict as $$ select round((6371000*2*asin(sqrt(power(sin(radians(($3-$1)/2)),2)+cos(radians($1))*cos(radians($3))*power(sin(radians(($4-$2)/2)),2))))::numeric,2) $$;
commit;
