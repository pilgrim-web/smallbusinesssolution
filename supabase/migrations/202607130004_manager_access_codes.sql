-- Secure manager access-code sign-in. Codes are bcrypt hashed and verified only by the trusted server.
begin;

alter table public.company_users
  add column if not exists access_code_hash text,
  add column if not exists failed_access_code_attempts integer not null default 0 check (failed_access_code_attempts >= 0),
  add column if not exists access_code_locked_until timestamptz,
  add column if not exists last_code_login_at timestamptz;

create or replace function public.manager_login_candidates(p_company_code text)
returns table(
  company_user_id uuid,
  user_id uuid,
  company_id uuid,
  access_code_hash text,
  code_locked boolean
)
language sql
security definer
set search_path=public
as $$
  select cu.id, cu.user_id, cu.company_id, cu.access_code_hash,
    cu.access_code_locked_until is not null and cu.access_code_locked_until > clock_timestamp()
  from public.company_users cu
  join public.companies c on c.id=cu.company_id
  where lower(c.code)=lower(trim(p_company_code))
    and cu.status='ACTIVE'
    and cu.role in ('OWNER','MANAGER')
    and cu.access_code_hash is not null
  order by case cu.role when 'OWNER' then 0 else 1 end, cu.id;
$$;

create or replace function public.record_manager_code_attempt(p_company_user_id uuid, p_success boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_user public.company_users%rowtype;
begin
  select * into v_user from public.company_users where id=p_company_user_id for update;
  if not found then return; end if;

  if p_success then
    update public.company_users set
      failed_access_code_attempts=0,
      access_code_locked_until=null,
      last_code_login_at=clock_timestamp()
    where id=p_company_user_id;
  elsif v_user.access_code_locked_until is null or v_user.access_code_locked_until <= clock_timestamp() then
    update public.company_users set
      failed_access_code_attempts=case when failed_access_code_attempts >= 4 then 0 else failed_access_code_attempts+1 end,
      access_code_locked_until=case when failed_access_code_attempts >= 4 then clock_timestamp()+interval '15 minutes' else null end
    where id=p_company_user_id;
  end if;
end;
$$;

revoke all on function public.manager_login_candidates(text) from public, anon, authenticated;
revoke all on function public.record_manager_code_attempt(uuid,boolean) from public, anon, authenticated;
grant execute on function public.manager_login_candidates(text) to service_role;
grant execute on function public.record_manager_code_attempt(uuid,boolean) to service_role;
revoke select(access_code_hash,failed_access_code_attempts,access_code_locked_until,last_code_login_at) on public.company_users from anon, authenticated;

commit;
