-- Manager-controlled employee, worksite assignment, PIN reset, and team group operations.
begin;

create table public.team_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique(company_id,name)
);

create table public.employee_team_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  team_group_id uuid not null references public.team_groups(id) on delete cascade,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);
create unique index employee_team_one_active on public.employee_team_memberships(employee_id,team_group_id) where status='ACTIVE';

create or replace function public.enforce_employee_team_tenant() returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.employees e where e.id=new.employee_id and e.company_id=new.company_id)
     or not exists(select 1 from public.team_groups t where t.id=new.team_group_id and t.company_id=new.company_id) then
    raise exception 'Employee and team must belong to the membership company';
  end if;
  return new;
end $$;
create trigger employee_team_tenant before insert or update on public.employee_team_memberships for each row execute function public.enforce_employee_team_tenant();

alter table public.team_groups enable row level security;
alter table public.employee_team_memberships enable row level security;
create policy team_groups_company_read on public.team_groups for select using(public.is_company_member(company_id));
create policy team_groups_manager_write on public.team_groups for all using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy team_memberships_company_read on public.employee_team_memberships for select using(public.is_company_member(company_id));
create policy team_memberships_manager_write on public.employee_team_memberships for all using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));

create or replace function public.is_manager_actor(p_company_id uuid,p_actor_user_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_users where company_id=p_company_id and user_id=p_actor_user_id and status='ACTIVE' and role in ('OWNER','MANAGER'))
$$;

create or replace function public.manager_set_employee_assignments(
  p_actor_user_id uuid,p_company_id uuid,p_employee_id uuid,p_worksite_ids uuid[],p_team_group_ids uuid[]
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_manager_actor(p_company_id,p_actor_user_id)
     or not exists(select 1 from public.employees where id=p_employee_id and company_id=p_company_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if exists(select 1 from unnest(coalesce(p_worksite_ids,array[]::uuid[])) selected(id)
    left join public.worksites w on w.id=selected.id and w.company_id=p_company_id and w.status='ACTIVE' where w.id is null) then raise exception 'INVALID_WORKSITE'; end if;
  if exists(select 1 from unnest(coalesce(p_team_group_ids,array[]::uuid[])) selected(id)
    left join public.team_groups t on t.id=selected.id and t.company_id=p_company_id and t.status='ACTIVE' where t.id is null) then raise exception 'INVALID_TEAM'; end if;
  update public.employee_worksites set status='INACTIVE' where company_id=p_company_id and employee_id=p_employee_id and status='ACTIVE';
  insert into public.employee_worksites(company_id,employee_id,worksite_id,status)
    select p_company_id,p_employee_id,id,'ACTIVE' from unnest(coalesce(p_worksite_ids,array[]::uuid[])) selected(id);
  update public.employee_team_memberships set status='INACTIVE' where company_id=p_company_id and employee_id=p_employee_id and status='ACTIVE';
  insert into public.employee_team_memberships(company_id,employee_id,team_group_id,status)
    select p_company_id,p_employee_id,id,'ACTIVE' from unnest(coalesce(p_team_group_ids,array[]::uuid[])) selected(id);
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,new_values)
    values(p_company_id,p_actor_user_id,'EMPLOYEE_ASSIGNMENTS_UPDATED','employee',p_employee_id,
      jsonb_build_object('worksite_ids',coalesce(p_worksite_ids,array[]::uuid[]),'team_group_ids',coalesce(p_team_group_ids,array[]::uuid[])));
end $$;

create or replace function public.manager_create_employee(
  p_actor_user_id uuid,p_company_id uuid,p_employee_number text,p_preferred_name text,p_pin_hash text,p_worksite_ids uuid[],p_team_group_ids uuid[]
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_employee_id uuid;
begin
  if not public.is_manager_actor(p_company_id,p_actor_user_id) then raise exception 'NOT_AUTHORIZED'; end if;
  insert into public.employees(company_id,employee_number,preferred_name,pin_hash)
    values(p_company_id,trim(p_employee_number),trim(p_preferred_name),p_pin_hash) returning id into v_employee_id;
  perform public.manager_set_employee_assignments(p_actor_user_id,p_company_id,v_employee_id,p_worksite_ids,p_team_group_ids);
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,new_values)
    values(p_company_id,p_actor_user_id,'EMPLOYEE_CREATED','employee',v_employee_id,
      jsonb_build_object('employee_number',trim(p_employee_number),'preferred_name',trim(p_preferred_name)));
  return v_employee_id;
end $$;

create or replace function public.manager_reset_employee_pin(
  p_actor_user_id uuid,p_company_id uuid,p_employee_id uuid,p_pin_hash text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_manager_actor(p_company_id,p_actor_user_id) then raise exception 'NOT_AUTHORIZED'; end if;
  update public.employees set pin_hash=p_pin_hash,failed_pin_attempts=0,pin_locked_until=null,updated_at=clock_timestamp()
    where id=p_employee_id and company_id=p_company_id;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  update public.employee_sessions set revoked_at=clock_timestamp() where employee_id=p_employee_id and company_id=p_company_id and revoked_at is null;
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,new_values)
    values(p_company_id,p_actor_user_id,'EMPLOYEE_PIN_RESET','employee',p_employee_id,jsonb_build_object('sessions_revoked',true));
end $$;

create or replace function public.manager_update_employee_profile(
  p_actor_user_id uuid,p_company_id uuid,p_employee_id uuid,p_preferred_name text,p_status text
) returns void language plpgsql security definer set search_path=public as $$
declare v_original jsonb;
begin
  if not public.is_manager_actor(p_company_id,p_actor_user_id) or p_status not in ('ACTIVE','INACTIVE') then raise exception 'NOT_AUTHORIZED'; end if;
  select jsonb_build_object('preferred_name',preferred_name,'status',status) into v_original from public.employees where id=p_employee_id and company_id=p_company_id for update;
  if v_original is null then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  update public.employees set preferred_name=trim(p_preferred_name),status=p_status,updated_at=clock_timestamp() where id=p_employee_id;
  if p_status='INACTIVE' then update public.employee_sessions set revoked_at=clock_timestamp() where employee_id=p_employee_id and revoked_at is null; end if;
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,original_values,new_values)
    values(p_company_id,p_actor_user_id,'EMPLOYEE_PROFILE_UPDATED','employee',p_employee_id,v_original,jsonb_build_object('preferred_name',trim(p_preferred_name),'status',p_status));
end $$;

create or replace function public.manager_save_team_group(
  p_actor_user_id uuid,p_company_id uuid,p_name text,p_description text,p_status text,p_team_group_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_manager_actor(p_company_id,p_actor_user_id) or p_status not in ('ACTIVE','INACTIVE') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_team_group_id is null then
    insert into public.team_groups(company_id,name,description,status,created_by,updated_by)
      values(p_company_id,trim(p_name),nullif(trim(p_description),''),p_status,p_actor_user_id,p_actor_user_id) returning id into v_id;
  else
    update public.team_groups set name=trim(p_name),description=nullif(trim(p_description),''),status=p_status,updated_by=p_actor_user_id,updated_at=clock_timestamp()
      where id=p_team_group_id and company_id=p_company_id returning id into v_id;
    if v_id is null then raise exception 'TEAM_NOT_FOUND'; end if;
  end if;
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,new_values)
    values(p_company_id,p_actor_user_id,case when p_team_group_id is null then 'TEAM_CREATED' else 'TEAM_UPDATED' end,'team_group',v_id,
      jsonb_build_object('name',trim(p_name),'status',p_status));
  return v_id;
end $$;

revoke all on function public.is_manager_actor(uuid,uuid) from public,anon,authenticated;
revoke all on function public.manager_set_employee_assignments(uuid,uuid,uuid,uuid[],uuid[]) from public,anon,authenticated;
revoke all on function public.manager_create_employee(uuid,uuid,text,text,text,uuid[],uuid[]) from public,anon,authenticated;
revoke all on function public.manager_reset_employee_pin(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.manager_update_employee_profile(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.manager_save_team_group(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.is_manager_actor(uuid,uuid) to service_role;
grant execute on function public.manager_set_employee_assignments(uuid,uuid,uuid,uuid[],uuid[]) to service_role;
grant execute on function public.manager_create_employee(uuid,uuid,text,text,text,uuid[],uuid[]) to service_role;
grant execute on function public.manager_reset_employee_pin(uuid,uuid,uuid,text) to service_role;
grant execute on function public.manager_update_employee_profile(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.manager_save_team_group(uuid,uuid,text,text,text,uuid) to service_role;
grant select,insert,update on public.team_groups,public.employee_team_memberships to service_role;
grant select on public.team_groups,public.employee_team_memberships to authenticated;
grant insert,update,delete on public.team_groups,public.employee_team_memberships to authenticated;

commit;
