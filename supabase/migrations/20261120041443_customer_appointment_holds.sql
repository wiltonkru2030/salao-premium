-- SALÃO PREMIUM — reserva temporária autenticada (HOLD) e confirmação atômica.
-- Aplicada no Supabase conectado em 20/11/2026 (20261120041443).
-- Impede colisões de agenda durante a janela de reserva; não substitui a
-- futura validação de expediente, intervalos e folgas.
begin;

create table public.appointment_holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active',
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  confirmed_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_holds_time_check check (ends_at > starts_at),
  constraint appointment_holds_expiry_check check (expires_at > created_at),
  constraint appointment_holds_status_check check (status in ('active','confirmed','expired','cancelled')),
  constraint appointment_holds_branch_fk
    foreign key (org_id, branch_id) references public.branches(org_id,id) on delete cascade,
  constraint appointment_holds_professional_fk
    foreign key (org_id, professional_id) references public.professionals(org_id,id) on delete cascade,
  constraint appointment_holds_service_fk
    foreign key (org_id, service_id) references public.services(org_id,id) on delete cascade
);

comment on table public.appointment_holds is
  'Reserva temporária de horário, criada por RPC autenticada e expirada após cinco minutos; não é um agendamento confirmado.';

create index appointment_holds_conflict_idx
  on public.appointment_holds(org_id, professional_id, starts_at, ends_at, expires_at)
  where status = 'active';
create index appointment_holds_customer_idx
  on public.appointment_holds(auth_user_id, status, expires_at);

alter table public.appointment_holds enable row level security;
revoke all on public.appointment_holds from public, anon, authenticated;
create policy appointment_holds_deny_direct_access
  on public.appointment_holds for all to authenticated
  using (false) with check (false);

alter table public.appointments
  add column appointment_hold_id uuid
  references public.appointment_holds(id) on delete set null;

create unique index appointments_appointment_hold_id_uidx
  on public.appointments(appointment_hold_id)
  where appointment_hold_id is not null;

create or replace function private.prevent_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
    raise exception 'O horário final deve ser posterior ao horário inicial.';
  end if;
  if new.professional_id is null then return new; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.org_id::text || ':' || new.professional_id::text, 0)
  );

  if new.status not in ('cancelled','no_show') and exists (
    select 1 from public.appointments a
    where a.org_id = new.org_id and a.professional_id = new.professional_id
      and a.id is distinct from new.id
      and a.status not in ('cancelled','no_show')
      and new.starts_at < a.ends_at and new.ends_at > a.starts_at
  ) then
    raise exception 'Já existe um agendamento deste profissional nesse horário.';
  end if;

  if new.status not in ('cancelled','no_show') and exists (
    select 1 from public.appointment_blocks b
    where b.org_id = new.org_id
      and (b.professional_id is null or b.professional_id = new.professional_id)
      and new.starts_at < b.ends_at and new.ends_at > b.starts_at
  ) then
    raise exception 'Este horário está bloqueado para o profissional.';
  end if;

  if new.status not in ('cancelled','no_show') and exists (
    select 1 from public.appointment_holds h
    where h.org_id = new.org_id and h.professional_id = new.professional_id
      and h.id is distinct from new.appointment_hold_id
      and h.status = 'active' and h.expires_at > now()
      and new.starts_at < h.ends_at and new.ends_at > h.starts_at
  ) then
    raise exception 'Este horário está temporariamente reservado por outra cliente.';
  end if;

  return new;
end;
$function$;

create or replace function public.create_customer_appointment_hold(
  p_org_id uuid, p_branch_id uuid, p_professional_id uuid,
  p_service_id uuid, p_starts_at timestamptz
)
returns table (hold_id uuid, expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_duration integer;
  v_end timestamptz;
  v_hold_id uuid;
  v_expires timestamptz;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para reservar um horário.' using errcode = '42501';
  end if;
  if p_org_id is null or p_branch_id is null or p_professional_id is null
     or p_service_id is null or p_starts_at is null then
    raise exception 'Preencha salão, unidade, profissional, serviço e horário.' using errcode = '22023';
  end if;
  if p_starts_at <= now() then
    raise exception 'Escolha um horário futuro.' using errcode = '22023';
  end if;

  select s.duration_minutes into v_duration
  from public.services s
  join public.branches b on b.org_id = s.org_id and b.id = p_branch_id and b.active
  join public.professionals p on p.org_id = s.org_id and p.id = p_professional_id
  join public.professional_services ps
    on ps.org_id = s.org_id and ps.professional_id = p.id and ps.service_id = s.id
  where s.org_id = p_org_id and s.id = p_service_id and s.active
    and p.active and (p.branch_id is null or p.branch_id = p_branch_id);

  if not found or v_duration is null or v_duration < 1 then
    raise exception 'Serviço ou profissional indisponível para esta unidade.' using errcode = '22023';
  end if;

  v_end := p_starts_at + make_interval(mins => v_duration);
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_professional_id::text, 0));

  update public.appointment_holds h
     set status = 'expired', updated_at = now()
   where h.org_id = p_org_id and h.professional_id = p_professional_id
     and h.status = 'active' and h.expires_at <= now();

  if exists (
    select 1 from public.appointments a
    where a.org_id = p_org_id and a.professional_id = p_professional_id
      and a.status not in ('cancelled','no_show')
      and p_starts_at < a.ends_at and v_end > a.starts_at
  ) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode = '23P01';
  end if;
  if exists (
    select 1 from public.appointment_blocks b
    where b.org_id = p_org_id and (b.professional_id is null or b.professional_id = p_professional_id)
      and p_starts_at < b.ends_at and v_end > b.starts_at
  ) then
    raise exception 'Este horário está bloqueado. Escolha outro.' using errcode = '23P01';
  end if;
  if exists (
    select 1 from public.appointment_holds h
    where h.org_id = p_org_id and h.professional_id = p_professional_id
      and h.status = 'active' and h.expires_at > now()
      and p_starts_at < h.ends_at and v_end > h.starts_at
  ) then
    raise exception 'Outra cliente está finalizando esta reserva. Tente outro horário.' using errcode = '23P01';
  end if;

  insert into public.appointment_holds
    (org_id, branch_id, professional_id, service_id, auth_user_id, starts_at, ends_at)
  values (p_org_id, p_branch_id, p_professional_id, p_service_id, v_user, p_starts_at, v_end)
  returning id, appointment_holds.expires_at into v_hold_id, v_expires;

  insert into public.audit_logs(org_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org_id, v_user, 'customer_appointment_hold_created',
    'appointment_holds', v_hold_id,
    jsonb_build_object('branch_id',p_branch_id,'professional_id',p_professional_id,
      'service_id',p_service_id,'starts_at',p_starts_at,'ends_at',v_end));

  return query select v_hold_id, v_expires;
end;
$function$;

create or replace function public.confirm_customer_appointment_hold(p_hold_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_hold public.appointment_holds%rowtype;
  v_profile public.customer_profiles%rowtype;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_service_name text;
  v_professional_name text;
  v_price numeric;
  v_membership_status text;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para confirmar o agendamento.' using errcode = '42501';
  end if;
  if p_hold_id is null then
    raise exception 'Reserva temporária inválida.' using errcode = '22023';
  end if;

  select * into v_hold from public.appointment_holds h
  where h.id = p_hold_id and h.auth_user_id = v_user for update;
  if not found then
    raise exception 'Reserva não encontrada para esta conta.' using errcode = '42501';
  end if;
  if v_hold.status = 'confirmed' and v_hold.confirmed_appointment_id is not null then
    return v_hold.confirmed_appointment_id;
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception 'O prazo da reserva terminou. Escolha um novo horário.' using errcode = '22023';
  end if;

  select * into v_profile from public.customer_profiles cp where cp.auth_user_id = v_user;
  if not found or length(btrim(coalesce(v_profile.full_name,''))) < 2 then
    raise exception 'Complete seu perfil antes de confirmar o agendamento.' using errcode = '22023';
  end if;

  select m.status into v_membership_status
  from public.customer_tenant_memberships m
  where m.org_id = v_hold.org_id and m.auth_user_id = v_user;
  if v_membership_status = 'suspended' then
    raise exception 'Seu acesso de cliente a este salão está suspenso.' using errcode = '42501';
  end if;

  select m.customer_id into v_customer_id
  from public.customer_account_customers m
  where m.org_id = v_hold.org_id and m.auth_user_id = v_user;

  if v_customer_id is null then
    insert into public.customers(org_id, branch_id, name, phone, email, active)
    values (v_hold.org_id, v_hold.branch_id, v_profile.full_name,
      v_profile.phone_e164, v_profile.email, true)
    returning id into v_customer_id;

    insert into public.customer_tenant_memberships
      (org_id, auth_user_id, status, source, joined_at)
    values (v_hold.org_id, v_user, 'active', 'booking_link', now())
    on conflict (org_id, auth_user_id)
    do update set status = 'active',
      joined_at = coalesce(public.customer_tenant_memberships.joined_at, excluded.joined_at),
      updated_at = now();

    insert into public.customer_account_customers
      (org_id, auth_user_id, customer_id, link_source, linked_at)
    values (v_hold.org_id, v_user, v_customer_id, 'customer_created', now());
  else
    update public.customer_tenant_memberships
       set status = 'active', joined_at = coalesce(joined_at, now()), updated_at = now()
     where org_id = v_hold.org_id and auth_user_id = v_user;
  end if;

  select s.name, s.price, p.name into v_service_name, v_price, v_professional_name
  from public.services s
  join public.professionals p on p.org_id = s.org_id and p.id = v_hold.professional_id
  where s.org_id = v_hold.org_id and s.id = v_hold.service_id and s.active;
  if not found then
    raise exception 'O serviço não está mais disponível. Atualize a seleção.' using errcode = '22023';
  end if;

  insert into public.appointments(
    org_id, branch_id, customer_id, professional_id, service_id,
    customer_name, customer_phone, service_name, professional_name,
    starts_at, ends_at, status, price, booking_source, created_by, appointment_hold_id
  )
  values (
    v_hold.org_id, v_hold.branch_id, v_customer_id, v_hold.professional_id, v_hold.service_id,
    v_profile.full_name, v_profile.phone_e164, v_service_name, v_professional_name,
    v_hold.starts_at, v_hold.ends_at, 'scheduled', v_price, 'customer', v_user, v_hold.id
  )
  returning id into v_appointment_id;

  update public.appointment_holds
     set status = 'confirmed', confirmed_appointment_id = v_appointment_id, updated_at = now()
   where id = v_hold.id;

  insert into public.audit_logs(org_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_hold.org_id, v_user, 'customer_appointment_confirmed',
    'appointments', v_appointment_id,
    jsonb_build_object('hold_id',v_hold.id,'branch_id',v_hold.branch_id,
      'professional_id',v_hold.professional_id,'service_id',v_hold.service_id));

  return v_appointment_id;
end;
$function$;

revoke all on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)
  from public, anon, authenticated;
revoke all on function public.confirm_customer_appointment_hold(uuid)
  from public, anon, authenticated;
grant execute on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)
  to authenticated;
grant execute on function public.confirm_customer_appointment_hold(uuid)
  to authenticated;

commit;