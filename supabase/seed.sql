-- Explicit local-only seed. Never apply this file to preview or production.
insert into public.companies(id,name,code,pay_frequency,timezone,location_mode)
values('11111111-1111-4111-8111-111111111111','Harbor Demo Company','HARBOR','BIWEEKLY','America/Los_Angeles','FLAG')
on conflict(id) do nothing;

insert into public.employees(id,company_id,employee_number,preferred_name,pin_hash,status)
values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','1042','Jordan',crypt('2468',gen_salt('bf',12)),'ACTIVE')
on conflict(id) do nothing;

insert into public.worksites(id,company_id,name,address_line_1,city,state,postal_code,country,timezone,latitude,longitude,geofence_radius_meters,require_location,location_mode,status)
values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Harbor Street Kitchen','412 Harbor Street','Oakland','CA','94607','US','America/Los_Angeles',37.7955,-122.2787,150,true,'FLAG','ACTIVE')
on conflict(id) do nothing;

insert into public.employee_worksites(company_id,employee_id,worksite_id,status)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','ACTIVE')
on conflict(employee_id,worksite_id) where status='ACTIVE' do nothing;
