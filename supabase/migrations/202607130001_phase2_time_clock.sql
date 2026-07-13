-- Phase 2: server-authoritative employee time clock and approval workflow.
-- PostgreSQL/Supabase compatible. All payroll event timestamps default on the server.
begin;
create extension if not exists pgcrypto;

do $$ begin create type public.worksite_status as enum ('ACTIVE','INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.assignment_status as enum ('ACTIVE','INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.geofence_mode as enum ('STRICT','FLAG','OPTIONAL'); exception when duplicate_object then null; end $$;
do $$ begin create type public.time_entry_status as enum ('OPEN','COMPLETED','VOIDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.approval_status as enum ('PENDING','APPROVED','REJECTED','NEEDS_REVIEW'); exception when duplicate_object then null; end $$;
do $$ begin create type public.break_status as enum ('OPEN','COMPLETED','VOIDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.break_type as enum ('UNPAID','PAID'); exception when duplicate_object then null; end $$;
do $$ begin create type public.time_event_type as enum ('CLOCK_IN','CLOCK_OUT','BREAK_START','BREAK_END','MANAGER_EDIT','MANAGER_APPROVAL','ENTRY_VOIDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.time_event_source as enum ('EMPLOYEE_WEB','KIOSK','ADMIN','SYSTEM'); exception when duplicate_object then null; end $$;
do $$ begin create type public.time_off_status as enum ('PENDING','APPROVED','DENIED','CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.time_off_type as enum ('UNPAID','VACATION','SICK','OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.correction_status as enum ('PENDING','APPROVED','DENIED','CANCELLED'); exception when duplicate_object then null; end $$;

-- Minimal tenant principals. Existing Phase 1 installations may already provide these.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  pay_frequency text not null default 'BIWEEKLY', timezone text not null default 'America/Los_Angeles',
  location_mode public.geofence_mode not null default 'FLAG', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('OWNER','MANAGER','STAFF')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')), unique(company_id,user_id)
);
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_number text not null, preferred_name text not null, pin_hash text not null,
  failed_pin_attempts integer not null default 0 check(failed_pin_attempts >= 0), pin_locked_until timestamptz,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, employee_number)
);

create table public.worksites (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, address_line_1 text not null, address_line_2 text, city text not null, state text not null,
  postal_code text not null, country text not null default 'US', timezone text not null,
  latitude numeric(9,6), longitude numeric(9,6), geofence_radius_meters integer not null default 150 check(geofence_radius_meters between 25 and 50000),
  require_location boolean not null default true, location_mode public.geofence_mode not null default 'FLAG',
  capture_break_location boolean not null default false, status public.worksite_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create index worksites_company_idx on public.worksites(company_id,status);

create table public.employee_worksites (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade, worksite_id uuid not null references public.worksites(id) on delete cascade,
  status public.assignment_status not null default 'ACTIVE', created_at timestamptz not null default now()
);
create unique index employee_worksites_one_active on public.employee_worksites(employee_id,worksite_id) where status='ACTIVE';

create table public.time_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), worksite_id uuid not null references public.worksites(id),
  clock_in_at timestamptz not null default now(), clock_out_at timestamptz, status public.time_entry_status not null default 'OPEN',
  total_work_minutes integer check(total_work_minutes >= 0), total_break_minutes integer check(total_break_minutes >= 0),
  regular_minutes integer check(regular_minutes >= 0), overtime_minutes integer check(overtime_minutes >= 0),
  employee_note text, manager_note text, approval_status public.approval_status not null default 'PENDING',
  approved_by uuid references auth.users(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((status='OPEN' and clock_out_at is null) or status<>'OPEN'), check(clock_out_at is null or clock_out_at >= clock_in_at)
);
create unique index time_entries_one_open_per_employee on public.time_entries(employee_id) where status='OPEN';
create index time_entries_company_date_idx on public.time_entries(company_id,clock_in_at desc);

create table public.break_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  break_type public.break_type not null default 'UNPAID', started_at timestamptz not null default now(), ended_at timestamptz,
  status public.break_status not null default 'OPEN', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((status='OPEN' and ended_at is null) or status<>'OPEN'), check(ended_at is null or ended_at >= started_at)
);
create unique index break_entries_one_open_per_entry on public.break_entries(time_entry_id) where status='OPEN';

create table public.time_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), time_entry_id uuid references public.time_entries(id), break_entry_id uuid references public.break_entries(id),
  worksite_id uuid references public.worksites(id), event_type public.time_event_type not null, server_timestamp timestamptz not null default now(),
  client_timestamp timestamptz, latitude numeric(9,6), longitude numeric(9,6), location_accuracy_meters numeric(10,2),
  distance_from_worksite_meters numeric(10,2), geofence_radius_meters integer, inside_geofence boolean,
  location_permission_status text not null check(location_permission_status in ('GRANTED','DENIED','UNAVAILABLE','NOT_REQUESTED')),
  location_verification_result text not null check(location_verification_result in ('VERIFIED','OUTSIDE','MISSING','NOT_REQUIRED')),
  source public.time_event_source not null, device_metadata jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null, actor_user_id uuid references auth.users(id), reason text, original_values jsonb,
  created_at timestamptz not null default now(), unique(employee_id,idempotency_key),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create index time_events_entry_idx on public.time_events(time_entry_id,server_timestamp);

create table public.employee_sessions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade, token_hash text not null unique,
  expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(), last_activity_at timestamptz not null default now(),
  check(expires_at > created_at)
);
create index employee_sessions_lookup_idx on public.employee_sessions(token_hash) where revoked_at is null;

create table public.time_correction_requests (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), time_entry_id uuid not null references public.time_entries(id),
  requested_change text not null, reason text not null, status public.correction_status not null default 'PENDING',
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, manager_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), request_type public.time_off_type not null,
  start_date date not null, end_date date not null, partial_day boolean not null default false, requested_minutes integer check(requested_minutes > 0),
  reason text, status public.time_off_status not null default 'PENDING', manager_note text,
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(end_date >= start_date)
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id), actor_employee_id uuid references public.employees(id), action text not null,
  entity_type text not null, entity_id uuid, reason text, original_values jsonb, new_values jsonb,
  created_at timestamptz not null default now()
);

-- Tenant helpers for authenticated managers. Employee API requests use a service-role server that
-- resolves the token hash, then scopes every statement to both session employee_id and company_id.
create or replace function public.is_company_manager(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_users cu where cu.company_id=target_company and cu.user_id=auth.uid() and cu.status='ACTIVE' and cu.role in ('OWNER','MANAGER'))
$$;
create or replace function public.is_company_member(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_users cu where cu.company_id=target_company and cu.user_id=auth.uid() and cu.status='ACTIVE')
$$;

-- Cross-tenant assignment integrity cannot be expressed with a simple FK.
create or replace function public.enforce_employee_worksite_tenant() returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.employees e where e.id=new.employee_id and e.company_id=new.company_id)
     or not exists(select 1 from public.worksites w where w.id=new.worksite_id and w.company_id=new.company_id) then
    raise exception 'Employee and worksite must belong to the assignment company';
  end if;
  return new;
end $$;
create trigger employee_worksite_tenant before insert or update on public.employee_worksites for each row execute function public.enforce_employee_worksite_tenant();

-- Event history is immutable even for authenticated managers; only trusted SECURITY DEFINER/service-role operations append it.
create or replace function public.prevent_time_event_mutation() returns trigger language plpgsql as $$ begin raise exception 'time_events are append-only'; end $$;
create trigger time_events_no_update before update or delete on public.time_events for each row execute function public.prevent_time_event_mutation();
create or replace function public.prevent_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit_logs are append-only'; end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs for each row execute function public.prevent_audit_mutation();

alter table public.worksites enable row level security;
alter table public.employee_worksites enable row level security;
alter table public.time_entries enable row level security;
alter table public.break_entries enable row level security;
alter table public.time_events enable row level security;
alter table public.employee_sessions enable row level security;
alter table public.time_correction_requests enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy worksites_company_read on public.worksites for select using(public.is_company_member(company_id));
create policy worksites_manager_write on public.worksites for all using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy assignments_company_read on public.employee_worksites for select using(public.is_company_member(company_id));
create policy assignments_manager_write on public.employee_worksites for all using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy entries_manager_read on public.time_entries for select using(public.is_company_manager(company_id));
create policy entries_manager_update on public.time_entries for update using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy breaks_manager_read on public.break_entries for select using(public.is_company_manager(company_id));
create policy breaks_manager_update on public.break_entries for update using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy events_manager_read on public.time_events for select using(public.is_company_manager(company_id));
create policy corrections_manager_access on public.time_correction_requests for all using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy time_off_manager_access on public.time_off_requests for all using(public.is_company_manager(company_id)) with check(public.is_company_manager(company_id));
create policy audit_manager_read on public.audit_logs for select using(public.is_company_manager(company_id));

-- No direct authenticated policies exist for employee_sessions, event insert/update/delete, or audit insert/update/delete.
-- This deliberately forces PIN/session and clock mutations through the trusted server transaction layer.
revoke all on public.employee_sessions from anon, authenticated;
revoke insert,update,delete on public.time_events from anon, authenticated;
revoke insert,update,delete on public.audit_logs from anon, authenticated;
revoke select(pin_hash,failed_pin_attempts,pin_locked_until) on public.employees from anon, authenticated;

commit;
