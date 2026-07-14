-- Service-role-only production bootstrapping for platform operators and pilot companies.
begin;

alter table public.platform_users
  add column created_by uuid references auth.users(id),
  add column last_login_at timestamptz;

alter table public.companies
  add column legal_name text,
  add column display_name text;

update public.companies
set legal_name=coalesce(legal_name,name),display_name=coalesce(display_name,name)
where legal_name is null or display_name is null;

alter table public.companies
  alter column legal_name set not null,
  alter column display_name set not null;

create or replace function public.bootstrap_platform_user(
  p_user_id uuid,
  p_role text,
  p_created_by uuid,
  p_reason text
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if p_role not in ('PLATFORM_ADMIN','SUPPORT_ADMIN') then raise exception 'INVALID_PLATFORM_ROLE'; end if;
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  if not exists(select 1 from auth.users where id=p_user_id)
    or not exists(select 1 from auth.users where id=p_created_by) then raise exception 'AUTH_USER_NOT_FOUND'; end if;
  if exists(select 1 from public.company_users where user_id=p_user_id) then raise exception 'PLATFORM_USER_MUST_NOT_BE_COMPANY_MEMBER'; end if;

  insert into public.platform_users(user_id,role,status,created_by)
  values(p_user_id,p_role,'ACTIVE',p_created_by)
  on conflict(user_id) do update set role=excluded.role,status='ACTIVE',created_by=coalesce(public.platform_users.created_by,excluded.created_by),updated_at=clock_timestamp()
  returning id into v_id;

  insert into public.platform_audit_logs(actor_user_id,action,reason,metadata)
  values(p_created_by,'PLATFORM_USER_BOOTSTRAPPED',trim(p_reason),jsonb_build_object('platform_user_id',v_id,'user_id',p_user_id,'role',p_role));
  return v_id;
end $$;

create or replace function public.onboard_pilot_company(
  p_actor_user_id uuid,
  p_legal_name text,
  p_display_name text,
  p_company_code text,
  p_timezone text,
  p_pay_frequency text,
  p_location_mode public.geofence_mode,
  p_owner_user_id uuid,
  p_manager_user_ids uuid[],
  p_worksites jsonb,
  p_employees jsonb
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_company_id uuid;
  v_worksite jsonb;
  v_employee jsonb;
  v_worksite_id uuid;
  v_employee_id uuid;
  v_manager_id uuid;
  v_assignment_name text;
  v_worksite_ids jsonb:='{}'::jsonb;
  v_employee_ids jsonb:='{}'::jsonb;
begin
  if not exists(select 1 from public.platform_users where user_id=p_actor_user_id and role='PLATFORM_ADMIN' and status='ACTIVE') then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if exists(select 1 from public.company_users where user_id=p_actor_user_id) then raise exception 'PLATFORM_ADMIN_MUST_BE_TENANT_NEUTRAL'; end if;
  if length(trim(coalesce(p_legal_name,'')))<2 or length(trim(coalesce(p_display_name,'')))<2 then raise exception 'COMPANY_NAME_REQUIRED'; end if;
  if length(trim(coalesce(p_company_code,'')))<4 or lower(trim(p_company_code)) in ('0000','test','demo') then raise exception 'INSECURE_COMPANY_CODE'; end if;
  if not exists(select 1 from auth.users where id=p_owner_user_id) then raise exception 'OWNER_AUTH_USER_NOT_FOUND'; end if;
  if jsonb_typeof(p_worksites)<>'array' or jsonb_array_length(p_worksites)<1 then raise exception 'WORKSITE_REQUIRED'; end if;
  if jsonb_typeof(p_employees)<>'array' or jsonb_array_length(p_employees)<1 then raise exception 'EMPLOYEE_REQUIRED'; end if;

  insert into public.companies(name,legal_name,display_name,code,pay_frequency,timezone,location_mode)
  values(trim(p_display_name),trim(p_legal_name),trim(p_display_name),upper(trim(p_company_code)),p_pay_frequency,p_timezone,p_location_mode)
  returning id into v_company_id;

  insert into public.company_users(company_id,user_id,role,status)
  values(v_company_id,p_owner_user_id,'OWNER','ACTIVE');

  foreach v_manager_id in array coalesce(p_manager_user_ids,'{}'::uuid[]) loop
    if not exists(select 1 from auth.users where id=v_manager_id) then raise exception 'MANAGER_AUTH_USER_NOT_FOUND'; end if;
    insert into public.company_users(company_id,user_id,role,status)
    values(v_company_id,v_manager_id,'MANAGER','ACTIVE')
    on conflict(company_id,user_id) do update set role=case when public.company_users.role='OWNER' then 'OWNER' else 'MANAGER' end,status='ACTIVE';
  end loop;

  for v_worksite in select value from jsonb_array_elements(p_worksites) loop
    if length(trim(coalesce(v_worksite->>'name','')))<2
      or length(trim(coalesce(v_worksite->>'addressLine1','')))<3
      or length(trim(coalesce(v_worksite->>'city','')))<2
      or length(trim(coalesce(v_worksite->>'state','')))<2
      or length(trim(coalesce(v_worksite->>'postalCode','')))<3 then raise exception 'INVALID_WORKSITE'; end if;
    insert into public.worksites(
      company_id,name,address_line_1,address_line_2,city,state,postal_code,country,timezone,
      latitude,longitude,geofence_radius_meters,require_location,capture_break_location,location_mode,status,
      created_by,updated_by
    ) values(
      v_company_id,trim(v_worksite->>'name'),trim(v_worksite->>'addressLine1'),nullif(trim(v_worksite->>'addressLine2'),''),
      trim(v_worksite->>'city'),trim(v_worksite->>'state'),trim(v_worksite->>'postalCode'),coalesce(nullif(trim(v_worksite->>'country'),''),'US'),
      coalesce(nullif(trim(v_worksite->>'timezone'),''),p_timezone),nullif(v_worksite->>'latitude','')::numeric,nullif(v_worksite->>'longitude','')::numeric,
      coalesce((v_worksite->>'geofenceRadiusMeters')::integer,150),coalesce((v_worksite->>'requireLocation')::boolean,true),
      coalesce((v_worksite->>'captureBreakLocation')::boolean,false),coalesce((v_worksite->>'locationMode')::public.geofence_mode,p_location_mode),
      'ACTIVE',p_actor_user_id,p_actor_user_id
    ) returning id into v_worksite_id;
    v_worksite_ids:=v_worksite_ids||jsonb_build_object(v_worksite->>'name',v_worksite_id);
  end loop;

  for v_employee in select value from jsonb_array_elements(p_employees) loop
    if length(trim(coalesce(v_employee->>'employeeNumber','')))<2
      or trim(v_employee->>'employeeNumber')='0000'
      or length(trim(coalesce(v_employee->>'preferredName','')))<2
      or coalesce(v_employee->>'pinHash','') !~ '^\$2[aby]\$' then raise exception 'INVALID_EMPLOYEE'; end if;
    insert into public.employees(company_id,employee_number,preferred_name,pin_hash,status)
    values(v_company_id,trim(v_employee->>'employeeNumber'),trim(v_employee->>'preferredName'),v_employee->>'pinHash','ACTIVE')
    returning id into v_employee_id;
    v_employee_ids:=v_employee_ids||jsonb_build_object(v_employee->>'preferredName',v_employee_id);

    for v_assignment_name in select jsonb_array_elements_text(coalesce(v_employee->'worksites','[]'::jsonb)) loop
      v_worksite_id:=nullif(v_worksite_ids->>v_assignment_name,'')::uuid;
      if v_worksite_id is null then raise exception 'EMPLOYEE_WORKSITE_NOT_FOUND'; end if;
      insert into public.employee_worksites(company_id,employee_id,worksite_id,status)
      values(v_company_id,v_employee_id,v_worksite_id,'ACTIVE');
    end loop;
  end loop;

  insert into public.platform_audit_logs(actor_user_id,company_id,action,reason,metadata)
  values(p_actor_user_id,v_company_id,'PILOT_COMPANY_ONBOARDED','Initial production pilot onboarding',
    jsonb_build_object('legal_name',p_legal_name,'display_name',p_display_name,'owner_user_id',p_owner_user_id,
      'manager_count',coalesce(array_length(p_manager_user_ids,1),0),'worksite_count',jsonb_array_length(p_worksites),'employee_count',jsonb_array_length(p_employees)));
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,reason,new_values)
  values(v_company_id,p_actor_user_id,'COMPANY_ONBOARDED','company',v_company_id,'Initial production pilot onboarding',
    jsonb_build_object('legal_name',p_legal_name,'display_name',p_display_name,'worksites',v_worksite_ids,'employees',v_employee_ids));

  return jsonb_build_object('company_id',v_company_id,'worksites',v_worksite_ids,'employees',v_employee_ids);
end $$;

revoke all on function public.bootstrap_platform_user(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.onboard_pilot_company(uuid,text,text,text,text,text,public.geofence_mode,uuid,uuid[],jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.bootstrap_platform_user(uuid,text,uuid,text) to service_role;
grant execute on function public.onboard_pilot_company(uuid,text,text,text,text,text,public.geofence_mode,uuid,uuid[],jsonb,jsonb) to service_role;

commit;
