-- Time-bound, audited cross-tenant support access. No permanent company membership is created.
begin;
create table public.platform_users(
  id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check(role in ('PLATFORM_ADMIN','SUPPORT_ADMIN')),status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.platform_support_grants(
  id uuid primary key default gen_random_uuid(),platform_user_id uuid not null references public.platform_users(id),user_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),reason text not null check(length(trim(reason)) between 10 and 500),
  granted_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,
  check(expires_at>granted_at and expires_at<=granted_at+interval '1 hour')
);
create index platform_support_active_idx on public.platform_support_grants(user_id,company_id,expires_at) where revoked_at is null;
create table public.platform_audit_logs(
  id uuid primary key default gen_random_uuid(),actor_user_id uuid not null references auth.users(id),company_id uuid references public.companies(id),
  action text not null,reason text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create or replace function public.prevent_platform_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'platform_audit_logs are append-only'; end $$;
create trigger platform_audit_no_mutation before update or delete on public.platform_audit_logs for each row execute function public.prevent_platform_audit_mutation();
alter table public.platform_users enable row level security;alter table public.platform_support_grants enable row level security;alter table public.platform_audit_logs enable row level security;
revoke all on public.platform_users,public.platform_support_grants,public.platform_audit_logs from anon,authenticated;

create or replace function public.has_active_support_grant(target_company uuid,target_user uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_support_grants g join public.platform_users p on p.id=g.platform_user_id
    where g.company_id=target_company and g.user_id=target_user and g.revoked_at is null and g.expires_at>clock_timestamp() and p.status='ACTIVE')
$$;
create or replace function public.is_company_manager(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_users cu where cu.company_id=target_company and cu.user_id=auth.uid() and cu.status='ACTIVE' and cu.role in ('OWNER','MANAGER'))
    or public.has_active_support_grant(target_company,auth.uid())
$$;
create or replace function public.is_company_member(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_users cu where cu.company_id=target_company and cu.user_id=auth.uid() and cu.status='ACTIVE')
    or public.has_active_support_grant(target_company,auth.uid())
$$;
create or replace function public.start_platform_support_access(p_user_id uuid,p_company_id uuid,p_reason text,p_minutes integer default 30)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_platform public.platform_users;v_id uuid;
begin
  select * into v_platform from public.platform_users where user_id=p_user_id and status='ACTIVE' for update;
  if v_platform.id is null or p_minutes not between 5 and 60 or length(trim(p_reason))<10 then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.companies where id=p_company_id) then raise exception 'COMPANY_NOT_FOUND'; end if;
  update public.platform_support_grants set revoked_at=clock_timestamp() where user_id=p_user_id and revoked_at is null;
  insert into public.platform_support_grants(platform_user_id,user_id,company_id,reason,expires_at)
    values(v_platform.id,p_user_id,p_company_id,trim(p_reason),clock_timestamp()+make_interval(mins=>p_minutes)) returning id into v_id;
  insert into public.platform_audit_logs(actor_user_id,company_id,action,reason,metadata)
    values(p_user_id,p_company_id,'SUPPORT_ACCESS_STARTED',trim(p_reason),jsonb_build_object('grant_id',v_id,'duration_minutes',p_minutes));
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,reason,new_values)
    values(p_company_id,p_user_id,'PLATFORM_SUPPORT_ACCESS','company',p_company_id,trim(p_reason),jsonb_build_object('grant_id',v_id,'duration_minutes',p_minutes));
  return v_id;
end $$;
create or replace function public.end_platform_support_access(p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_company uuid;
begin
  if not exists(select 1 from public.platform_users where user_id=p_user_id and status='ACTIVE') then raise exception 'NOT_AUTHORIZED'; end if;
  for v_company in update public.platform_support_grants set revoked_at=clock_timestamp() where user_id=p_user_id and revoked_at is null returning company_id loop
    insert into public.platform_audit_logs(actor_user_id,company_id,action) values(p_user_id,v_company,'SUPPORT_ACCESS_ENDED');
  end loop;
end $$;
revoke all on function public.has_active_support_grant(uuid,uuid),public.start_platform_support_access(uuid,uuid,text,integer),public.end_platform_support_access(uuid) from public,anon,authenticated;
grant execute on function public.has_active_support_grant(uuid,uuid),public.start_platform_support_access(uuid,uuid,text,integer),public.end_platform_support_access(uuid) to service_role;
grant select,insert,update on public.platform_users,public.platform_support_grants,public.platform_audit_logs to service_role;
commit;
