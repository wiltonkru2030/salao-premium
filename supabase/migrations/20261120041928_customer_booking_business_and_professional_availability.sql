-- Disponibilidade operacional por unidade e profissional.
-- Intervalos usam o fuso horário definido em organizations.timezone.
begin;

create table if not exists public.branch_business_hours (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_business_hours_positive_interval check (closes_at > opens_at),
  constraint branch_business_hours_branch_fk foreign key (org_id, branch_id) references public.branches(org_id, id) on delete cascade
);
create index if not exists branch_business_hours_lookup_idx on public.branch_business_hours(org_id, branch_id, weekday, active);

create table if not exists public.professional_working_hours (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_working_hours_positive_interval check (ends_at > starts_at),
  constraint professional_working_hours_professional_fk foreign key (org_id, professional_id) references public.professionals(org_id, id) on delete cascade
);
create index if not exists professional_working_hours_lookup_idx on public.professional_working_hours(org_id, professional_id, weekday, active);

create table if not exists public.branch_closures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint branch_closures_positive_interval check (ends_at > starts_at),
  constraint branch_closures_branch_fk foreign key (org_id, branch_id) references public.branches(org_id, id) on delete cascade
);
create index if not exists branch_closures_lookup_idx on public.branch_closures(org_id, branch_id, starts_at, ends_at);

create table if not exists public.professional_time_off (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint professional_time_off_positive_interval check (ends_at > starts_at),
  constraint professional_time_off_professional_fk foreign key (org_id, professional_id) references public.professionals(org_id, id) on delete cascade
);
create index if not exists professional_time_off_lookup_idx on public.professional_time_off(org_id, professional_id, starts_at, ends_at);

alter table public.branch_business_hours enable row level security;
alter table public.professional_working_hours enable row level security;
alter table public.branch_closures enable row level security;
alter table public.professional_time_off enable row level security;

drop policy if exists branch_hours_member_read on public.branch_business_hours;
create policy branch_hours_member_read on public.branch_business_hours for select to authenticated using ((select private.is_org_member(org_id)));
drop policy if exists branch_hours_admin_write on public.branch_business_hours;
create policy branch_hours_admin_write on public.branch_business_hours for all to authenticated using ((select private.has_org_role(org_id, array['owner','admin']))) with check ((select private.has_org_role(org_id, array['owner','admin'])));

drop policy if exists professional_hours_member_read on public.professional_working_hours;
create policy professional_hours_member_read on public.professional_working_hours for select to authenticated using ((select private.is_org_member(org_id)));
drop policy if exists professional_hours_admin_write on public.professional_working_hours;
create policy professional_hours_admin_write on public.professional_working_hours for all to authenticated using ((select private.has_org_role(org_id, array['owner','admin']))) with check ((select private.has_org_role(org_id, array['owner','admin'])));

drop policy if exists branch_closures_member_read on public.branch_closures;
create policy branch_closures_member_read on public.branch_closures for select to authenticated using ((select private.is_org_member(org_id)));
drop policy if exists branch_closures_admin_write on public.branch_closures;
create policy branch_closures_admin_write on public.branch_closures for all to authenticated using ((select private.has_org_role(org_id, array['owner','admin']))) with check ((select private.has_org_role(org_id, array['owner','admin'])));

drop policy if exists professional_time_off_member_read on public.professional_time_off;
create policy professional_time_off_member_read on public.professional_time_off for select to authenticated using ((select private.is_org_member(org_id)));
drop policy if exists professional_time_off_admin_write on public.professional_time_off;
create policy professional_time_off_admin_write on public.professional_time_off for all to authenticated using ((select private.has_org_role(org_id, array['owner','admin']))) with check ((select private.has_org_role(org_id, array['owner','admin'])));

grant select, insert, update, delete on public.branch_business_hours, public.professional_working_hours, public.branch_closures, public.professional_time_off to authenticated;
revoke all on public.branch_business_hours, public.professional_working_hours, public.branch_closures, public.professional_time_off from anon;

create or replace function private.create_customer_appointment_hold(
  p_org_id uuid, p_branch_id uuid, p_professional_id uuid, p_service_id uuid, p_starts_at timestamptz
) returns table(hold_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_duration integer;
  v_end timestamptz;
  v_hold_id uuid;
  v_expires timestamptz;
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday integer;
begin
  if v_user is null then raise exception 'Entre na sua conta para reservar um horário.' using errcode = '42501'; end if;
  if p_org_id is null or p_branch_id is null or p_professional_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'Preencha salão, unidade, profissional, serviço e horário.' using errcode = '22023';
  end if;
  if p_starts_at <= now() then raise exception 'Escolha um horário futuro.' using errcode = '22023'; end if;

  select s.duration_minutes, o.timezone into v_duration, v_timezone
  from public.services s
  join public.organizations o on o.id = s.org_id
  join public.branches b on b.org_id = s.org_id and b.id = p_branch_id and b.active
  join public.professionals p on p.org_id = s.org_id and p.id = p_professional_id
  join public.professional_services ps on ps.org_id = s.org_id and ps.professional_id = p.id and ps.service_id = s.id
  where s.org_id = p_org_id and s.id = p_service_id and s.active and p.active
    and (p.branch_id is null or p.branch_id = p_branch_id);

  if not found or v_duration is null or v_duration < 1 then
    raise exception 'Serviço ou profissional indisponível para esta unidade.' using errcode = '22023';
  end if;

  v_end := p_starts_at + make_interval(mins => v_duration);
  v_local_start := p_starts_at at time zone v_timezone;
  v_local_end := v_end at time zone v_timezone;
  v_weekday := extract(dow from v_local_start)::integer;

  if v_local_start::date <> v_local_end::date then
    raise exception 'O serviço precisa terminar dentro do mesmo expediente. Escolha outro horário.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.branch_business_hours h
    where h.org_id=p_org_id and h.branch_id=p_branch_id and h.weekday=v_weekday and h.active
      and h.opens_at <= v_local_start::time and h.closes_at >= v_local_end::time
  ) then raise exception 'A unidade não atende durante todo esse horário.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.professional_working_hours h
    where h.org_id=p_org_id and h.professional_id=p_professional_id and h.weekday=v_weekday and h.active
      and h.starts_at <= v_local_start::time and h.ends_at >= v_local_end::time
  ) then raise exception 'O profissional não trabalha durante todo esse horário.' using errcode = '22023'; end if;
  if exists (
    select 1 from public.branch_closures c
    where c.org_id=p_org_id and c.branch_id=p_branch_id and p_starts_at<c.ends_at and v_end>c.starts_at
  ) then raise exception 'A unidade estará fechada nesse período.' using errcode = '23P01'; end if;
  if exists (
    select 1 from public.professional_time_off t
    where t.org_id=p_org_id and t.professional_id=p_professional_id and p_starts_at<t.ends_at and v_end>t.starts_at
  ) then raise exception 'O profissional não estará disponível nesse período.' using errcode = '23P01'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_professional_id::text, 0));

  update public.appointment_holds h set status='expired', updated_at=now()
  where h.org_id=p_org_id and h.professional_id=p_professional_id and h.status='active' and h.expires_at<=now();

  if exists (
    select 1 from public.appointments a where a.org_id=p_org_id and a.professional_id=p_professional_id
      and a.status not in ('cancelled','no_show') and p_starts_at<a.ends_at and v_end>a.starts_at
  ) then raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode = '23P01'; end if;
  if exists (
    select 1 from public.appointment_blocks b where b.org_id=p_org_id
      and (b.professional_id is null or b.professional_id=p_professional_id)
      and (b.branch_id is null or b.branch_id=p_branch_id)
      and p_starts_at<b.ends_at and v_end>b.starts_at
  ) then raise exception 'Este horário está bloqueado. Escolha outro.' using errcode = '23P01'; end if;
  if exists (
    select 1 from public.appointment_holds h where h.org_id=p_org_id and h.professional_id=p_professional_id
      and h.status='active' and h.expires_at>now() and p_starts_at<h.ends_at and v_end>h.starts_at
  ) then raise exception 'Outra cliente está finalizando esta reserva. Tente outro horário.' using errcode = '23P01'; end if;

  insert into public.appointment_holds(org_id,branch_id,professional_id,service_id,auth_user_id,starts_at,ends_at)
  values(p_org_id,p_branch_id,p_professional_id,p_service_id,v_user,p_starts_at,v_end)
  returning id, appointment_holds.expires_at into v_hold_id,v_expires;

  insert into public.audit_logs(org_id,actor_id,action,entity_type,entity_id,metadata)
  values(p_org_id,v_user,'customer_appointment_hold_created','appointment_holds',v_hold_id,
    jsonb_build_object('branch_id',p_branch_id,'professional_id',p_professional_id,'service_id',p_service_id,'starts_at',p_starts_at,'ends_at',v_end));
  return query select v_hold_id,v_expires;
end;
$function$;

revoke all on function private.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) from public, anon;
grant execute on function private.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) to authenticated;
commit;
