-- Catálogo por unidade: NULL preserva o catálogo global existente.
-- As funções privadas mantêm assinaturas, permissões e contratos públicos.
alter table public.services add column if not exists branch_id uuid;
do $block$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.services'::regclass and conname='services_org_id_branch_id_fkey') then
  alter table public.services add constraint services_org_id_branch_id_fkey foreign key(org_id,branch_id) references public.branches(org_id,id);
 end if;
end;
$block$;
create index if not exists services_org_branch_active_name_idx on public.services(org_id,branch_id,active,name);
comment on column public.services.branch_id is 'Unidade proprietária do serviço; NULL representa catálogo compartilhado da organização.';
CREATE OR REPLACE FUNCTION private.compute_customer_coupon(p_org_id uuid, p_branch_id uuid, p_service_id uuid, p_coupon_code text)
 RETURNS TABLE(coupon_id uuid, code text, title text, discount_type text, discount_value numeric, original_amount numeric, discount_amount numeric, final_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_coupon public.salon_coupons%rowtype;
  v_price numeric(12,2);
  v_usage bigint;
  v_user_usage bigint;
  v_discount numeric(12,2);
begin
  if v_user is null then raise exception 'Entre na sua conta para usar um cupom.' using errcode='42501'; end if;
  if p_org_id is null or p_branch_id is null or p_service_id is null
     or p_coupon_code is null or length(btrim(p_coupon_code)) not between 3 and 32
     or upper(btrim(p_coupon_code)) !~ '^[A-Z0-9_-]+$' then
    raise exception 'Informe um código de cupom válido.' using errcode='22023';
  end if;

  select c.* into v_coupon
  from public.salon_coupons c
  where c.org_id=p_org_id and upper(c.code)=upper(btrim(p_coupon_code))
    and c.active and c.starts_at<=now() and c.ends_at>now()
    and (c.branch_id is null or c.branch_id=p_branch_id);

  if not found then raise exception 'Cupom inválido, expirado ou indisponível para esta unidade.' using errcode='22023'; end if;
  if not exists (
    select 1 from public.salon_public_profiles sp
    join public.branch_public_profiles bp on bp.org_id=sp.org_id and bp.branch_id=p_branch_id and bp.is_published
    join public.branches b on b.org_id=bp.org_id and b.id=bp.branch_id and b.active
    where sp.org_id=p_org_id and sp.is_published
  ) then raise exception 'Este salão ainda não está disponível para agendamento público.' using errcode='22023'; end if;

  select s.price into v_price
  from public.services s
  where s.org_id=p_org_id and s.id=p_service_id and s.active
    and (s.branch_id is null or s.branch_id=p_branch_id);

  if not found then raise exception 'O serviço selecionado não está mais disponível.' using errcode='22023'; end if;
  if v_price<v_coupon.minimum_amount then raise exception 'O serviço não atinge o valor mínimo deste cupom.' using errcode='22023'; end if;

  if exists(select 1 from public.salon_coupon_services cs where cs.org_id=p_org_id and cs.coupon_id=v_coupon.id)
     and not exists(select 1 from public.salon_coupon_services cs where cs.org_id=p_org_id and cs.coupon_id=v_coupon.id and cs.service_id=p_service_id) then
    raise exception 'Este cupom não é válido para o serviço selecionado.' using errcode='22023';
  end if;

  select count(*) into v_usage
  from public.customer_coupon_redemptions r
  left join public.appointment_holds h on h.id=r.hold_id
  where r.org_id=p_org_id and r.coupon_id=v_coupon.id
    and (r.status='redeemed' or (r.status='reserved' and h.status='active' and h.expires_at>now()));

  if v_coupon.usage_limit is not null and v_usage>=v_coupon.usage_limit then
    raise exception 'Este cupom atingiu o limite de utilizações.' using errcode='22023';
  end if;

  select count(*) into v_user_usage
  from public.customer_coupon_redemptions r
  left join public.appointment_holds h on h.id=r.hold_id
  where r.org_id=p_org_id and r.coupon_id=v_coupon.id and r.auth_user_id=v_user
    and (r.status='redeemed' or (r.status='reserved' and h.status='active' and h.expires_at>now()));

  if v_user_usage>=v_coupon.usage_per_customer then
    raise exception 'Você já utilizou este cupom ou possui uma reserva ativa com ele.' using errcode='22023';
  end if;

  v_discount:=case
    when v_coupon.discount_type='percent'
      then least(round(v_price*v_coupon.discount_value/100,2),coalesce(v_coupon.max_discount_amount,v_price))
    else least(v_coupon.discount_value,v_price)
  end;
  v_discount:=greatest(0,least(v_discount,v_price));

  return query select v_coupon.id,upper(v_coupon.code),v_coupon.title,v_coupon.discount_type,
    v_coupon.discount_value,v_price,v_discount,(v_price-v_discount);
end;
$function$;

CREATE OR REPLACE FUNCTION private.confirm_customer_appointment_hold(p_hold_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  select * into v_hold
  from public.appointment_holds h
  where h.id = p_hold_id and h.auth_user_id = v_user
  for update;

  if not found then
    raise exception 'Reserva não encontrada para esta conta.' using errcode = '42501';
  end if;

  if v_hold.status = 'confirmed' and v_hold.confirmed_appointment_id is not null then
    return v_hold.confirmed_appointment_id;
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception 'O prazo da reserva terminou. Escolha um novo horário.' using errcode = '22023';
  end if;

  select * into v_profile
  from public.customer_profiles cp
  where cp.auth_user_id = v_user;

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
    values (
      v_hold.org_id, v_hold.branch_id, v_profile.full_name,
      v_profile.phone_e164, v_profile.email, true
    )
    returning id into v_customer_id;

    insert into public.customer_tenant_memberships
      (org_id, auth_user_id, status, source, joined_at)
    values (v_hold.org_id, v_user, 'active', 'booking_link', now())
    on conflict (org_id, auth_user_id)
    do update set status = 'active', joined_at = coalesce(
      public.customer_tenant_memberships.joined_at, excluded.joined_at
    ), updated_at = now();

    insert into public.customer_account_customers
      (org_id, auth_user_id, customer_id, link_source, linked_at)
    values (v_hold.org_id, v_user, v_customer_id, 'customer_created', now());
  else
    update public.customer_tenant_memberships
       set status = 'active', joined_at = coalesce(joined_at, now()), updated_at = now()
     where org_id = v_hold.org_id and auth_user_id = v_user;
  end if;

  select s.name, s.price, p.name
    into v_service_name, v_price, v_professional_name
  from public.services s
  join public.professionals p on p.org_id = s.org_id and p.id = v_hold.professional_id
  where s.org_id = v_hold.org_id and s.id = v_hold.service_id and s.active
    and (s.branch_id is null or s.branch_id=v_hold.branch_id)
    and p.active and (p.branch_id is null or p.branch_id=v_hold.branch_id);

  if not found then
    raise exception 'O serviço não está mais disponível. Atualize a seleção.' using errcode = '22023';
  end if;

  insert into public.appointments(
    org_id, branch_id, customer_id, professional_id, service_id,
    customer_name, customer_phone, service_name, professional_name,
    starts_at, ends_at, status, price, booking_source, created_by,
    appointment_hold_id
  )
  values (
    v_hold.org_id, v_hold.branch_id, v_customer_id, v_hold.professional_id, v_hold.service_id,
    v_profile.full_name, v_profile.phone_e164, v_service_name, v_professional_name,
    v_hold.starts_at, v_hold.ends_at, 'scheduled', v_price, 'customer', v_user,
    v_hold.id
  )
  returning id into v_appointment_id;

  update public.appointment_holds
     set status = 'confirmed', confirmed_appointment_id = v_appointment_id, updated_at = now()
   where id = v_hold.id;

  insert into public.audit_logs(org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_hold.org_id, v_user, 'customer_appointment_confirmed',
    'appointments', v_appointment_id,
    jsonb_build_object('hold_id',v_hold.id,'branch_id',v_hold.branch_id,
      'professional_id',v_hold.professional_id,'service_id',v_hold.service_id)
  );

  return v_appointment_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_customer_appointment_hold(p_org_id uuid, p_branch_id uuid, p_professional_id uuid, p_service_id uuid, p_starts_at timestamp with time zone)
 RETURNS TABLE(hold_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  select s.duration_minutes, o.timezone
    into v_duration, v_timezone
  from public.services s
  join public.organizations o on o.id = s.org_id
  join public.branches b on b.org_id = s.org_id and b.id = p_branch_id and b.active
  join public.professionals p on p.org_id = s.org_id and p.id = p_professional_id
  join public.professional_services ps
    on ps.org_id = s.org_id and ps.professional_id = p.id and ps.service_id = s.id
  where s.org_id = p_org_id
    and s.id = p_service_id
    and s.active
    and (s.branch_id is null or s.branch_id=p_branch_id)
    and p.active
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
    where h.org_id = p_org_id and h.branch_id = p_branch_id
      and h.weekday = v_weekday and h.active
      and h.opens_at <= v_local_start::time
      and h.closes_at >= v_local_end::time
  ) then
    raise exception 'A unidade não atende durante todo esse horário.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.professional_working_hours h
    where h.org_id = p_org_id and h.professional_id = p_professional_id
      and h.weekday = v_weekday and h.active
      and h.starts_at <= v_local_start::time
      and h.ends_at >= v_local_end::time
  ) then
    raise exception 'O profissional não trabalha durante todo esse horário.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.branch_closures c
    where c.org_id = p_org_id and c.branch_id = p_branch_id
      and p_starts_at < c.ends_at and v_end > c.starts_at
  ) then
    raise exception 'A unidade estará fechada nesse período.' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.professional_time_off t
    where t.org_id = p_org_id and t.professional_id = p_professional_id
      and p_starts_at < t.ends_at and v_end > t.starts_at
  ) then
    raise exception 'O profissional não estará disponível nesse período.' using errcode = '23P01';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || p_professional_id::text, 0)
  );

  update public.appointment_holds h
     set status = 'expired', updated_at = now()
   where h.org_id = p_org_id
     and h.professional_id = p_professional_id
     and h.status = 'active'
     and h.expires_at <= now();

  if exists (
    select 1 from public.appointments a
    where a.org_id = p_org_id
      and a.professional_id = p_professional_id
      and a.status not in ('cancelled','no_show')
      and p_starts_at < a.ends_at and v_end > a.starts_at
  ) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.appointment_blocks b
    where b.org_id = p_org_id
      and (b.professional_id is null or b.professional_id = p_professional_id)
      and (b.branch_id is null or b.branch_id = p_branch_id)
      and p_starts_at < b.ends_at and v_end > b.starts_at
  ) then
    raise exception 'Este horário está bloqueado. Escolha outro.' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.appointment_holds h
    where h.org_id = p_org_id
      and h.professional_id = p_professional_id
      and h.status = 'active'
      and h.expires_at > now()
      and p_starts_at < h.ends_at and v_end > h.starts_at
  ) then
    raise exception 'Outra cliente está finalizando esta reserva. Tente outro horário.' using errcode = '23P01';
  end if;

  insert into public.appointment_holds
    (org_id, branch_id, professional_id, service_id, auth_user_id, starts_at, ends_at)
  values
    (p_org_id, p_branch_id, p_professional_id, p_service_id, v_user, p_starts_at, v_end)
  returning id, appointment_holds.expires_at into v_hold_id, v_expires;

  insert into public.audit_logs(org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_org_id, v_user, 'customer_appointment_hold_created',
    'appointment_holds', v_hold_id,
    jsonb_build_object('branch_id',p_branch_id,'professional_id',p_professional_id,
      'service_id',p_service_id,'starts_at',p_starts_at,'ends_at',v_end)
  );

  return query select v_hold_id, v_expires;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_customer_appointment_hold_with_coupon(p_org_id uuid, p_branch_id uuid, p_professional_id uuid, p_service_id uuid, p_starts_at timestamp with time zone, p_coupon_code text DEFAULT NULL::text)
 RETURNS TABLE(hold_id uuid, expires_at timestamp with time zone, coupon_id uuid, coupon_discount_amount numeric, coupon_final_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_coupon public.salon_coupons%rowtype;
  v_calc record;
  v_hold_id uuid;
  v_expires timestamptz;
  v_price numeric(12,2);
begin
  if v_user is null then raise exception 'Entre na sua conta para reservar um horário.' using errcode='42501'; end if;
  if not exists (
    select 1 from public.salon_public_profiles sp
    join public.branch_public_profiles bp on bp.org_id=sp.org_id and bp.branch_id=p_branch_id and bp.is_published
    join public.branches b on b.org_id=bp.org_id and b.id=bp.branch_id and b.active
    where sp.org_id=p_org_id and sp.is_published
  ) then raise exception 'Este salão ainda não está disponível para agendamento público.' using errcode='22023'; end if;

  if nullif(btrim(p_coupon_code),'') is not null then
    select c.* into v_coupon
    from public.salon_coupons c
    where c.org_id=p_org_id and upper(c.code)=upper(btrim(p_coupon_code))
      and c.active and c.starts_at<=now() and c.ends_at>now()
      and (c.branch_id is null or c.branch_id=p_branch_id)
    for update;
    if not found then raise exception 'Cupom inválido, expirado ou indisponível para esta unidade.' using errcode='22023'; end if;
    select * into v_calc from private.compute_customer_coupon(p_org_id,p_branch_id,p_service_id,p_coupon_code);
    v_price:=v_calc.original_amount;
  else
    select s.price into v_price from public.services s
    where s.org_id=p_org_id and s.id=p_service_id and s.active
      and (s.branch_id is null or s.branch_id=p_branch_id);
    if not found then raise exception 'O serviço selecionado não está mais disponível.' using errcode='22023'; end if;
    select null::uuid as coupon_id, 0::numeric as discount_amount,
           v_price::numeric as final_amount, v_price::numeric as original_amount
      into v_calc;
  end if;

  select h.hold_id,h.expires_at into v_hold_id,v_expires
  from private.create_customer_appointment_hold(p_org_id,p_branch_id,p_professional_id,p_service_id,p_starts_at) h;

  update public.appointment_holds
     set coupon_id=v_calc.coupon_id,
         coupon_discount_amount=coalesce(v_calc.discount_amount,0),
         coupon_final_amount=v_calc.final_amount,
         coupon_code_snapshot=case when v_calc.coupon_id is null then null else upper(btrim(p_coupon_code)) end,
         updated_at=now()
   where id=v_hold_id and auth_user_id=v_user;

  if v_calc.coupon_id is not null then
    insert into public.customer_coupon_redemptions(
      org_id,coupon_id,auth_user_id,hold_id,original_amount,discount_amount,final_amount,status
    ) values (
      p_org_id,v_calc.coupon_id,v_user,v_hold_id,v_calc.original_amount,
      v_calc.discount_amount,v_calc.final_amount,'reserved'
    );
  end if;

  return query select v_hold_id,v_expires,v_calc.coupon_id,
    coalesce(v_calc.discount_amount,0),v_calc.final_amount;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_customer_available_slots(p_org_id uuid, p_branch_id uuid, p_service_id uuid, p_date date, p_professional_id uuid, p_interval_minutes integer)
 RETURNS TABLE(starts_at timestamp with time zone, professional_id uuid, professional_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_timezone text;
  v_duration integer;
begin
  if p_org_id is null or p_branch_id is null or p_service_id is null or p_date is null then
    raise exception 'Informe salão, unidade, serviço e data.' using errcode='22023';
  end if;
  if p_interval_minutes is null or p_interval_minutes < 5 or p_interval_minutes > 60 then
    raise exception 'O intervalo de consulta deve estar entre 5 e 60 minutos.' using errcode='22023';
  end if;

  select org.timezone,service.duration_minutes into v_timezone,v_duration
  from public.salon_public_profiles profile
  join public.branch_public_profiles branch_profile on branch_profile.org_id=profile.org_id
    and branch_profile.branch_id=p_branch_id and branch_profile.is_published
  join public.organizations org on org.id=profile.org_id
  join public.branches branch on branch.org_id=profile.org_id and branch.id=p_branch_id and branch.active
  join public.services service on service.org_id=profile.org_id and service.id=p_service_id and service.active
    and (service.branch_id is null or service.branch_id=p_branch_id)
  where profile.org_id=p_org_id and profile.is_published;

  if not found then
    raise exception 'Esta unidade ou serviço não está publicado para agendamento.' using errcode='22023';
  end if;
  if p_date < (now() at time zone v_timezone)::date then
    raise exception 'Escolha uma data de hoje em diante.' using errcode='22023';
  end if;

  return query
  with eligible as (
    select distinct professional.id as pro_id,professional.name as pro_name,
      greatest(branch_hours.opens_at,working.starts_at) as local_open,
      least(branch_hours.closes_at,working.ends_at) as local_close
    from public.professional_services assignment
    join public.professionals professional on professional.org_id=assignment.org_id
      and professional.id=assignment.professional_id and professional.active
      and (professional.branch_id is null or professional.branch_id=p_branch_id)
    join public.branch_business_hours branch_hours on branch_hours.org_id=p_org_id
      and branch_hours.branch_id=p_branch_id
      and branch_hours.weekday=extract(dow from p_date)::integer and branch_hours.active
    join public.professional_working_hours working on working.org_id=p_org_id
      and working.professional_id=professional.id
      and working.weekday=extract(dow from p_date)::integer and working.active
    where assignment.org_id=p_org_id and assignment.service_id=p_service_id
      and (p_professional_id is null or professional.id=p_professional_id)
      and greatest(branch_hours.opens_at,working.starts_at)<least(branch_hours.closes_at,working.ends_at)
  ),
  candidates as (
    select eligible.pro_id,eligible.pro_name,
      (p_date+generated.local_start)::timestamp as local_start,
      ((p_date+generated.local_start)+make_interval(mins=>v_duration))::timestamp as local_end
    from eligible
    cross join lateral generate_series(
      (p_date+eligible.local_open)::timestamp,
      (p_date+eligible.local_close-make_interval(mins=>v_duration))::timestamp,
      make_interval(mins=>p_interval_minutes)
    ) as generated(local_start)
  )
  select (candidate.local_start at time zone v_timezone),candidate.pro_id,candidate.pro_name
  from candidates candidate
  where (candidate.local_start at time zone v_timezone)>now()
    and not exists(select 1 from public.appointments appointment
      where appointment.org_id=p_org_id and appointment.professional_id=candidate.pro_id
        and appointment.status not in ('cancelled','no_show')
        and (candidate.local_start at time zone v_timezone)<appointment.ends_at
        and (candidate.local_end at time zone v_timezone)>appointment.starts_at)
    and not exists(select 1 from public.appointment_blocks block
      where block.org_id=p_org_id and (block.professional_id is null or block.professional_id=candidate.pro_id)
        and (block.branch_id is null or block.branch_id=p_branch_id)
        and (candidate.local_start at time zone v_timezone)<block.ends_at
        and (candidate.local_end at time zone v_timezone)>block.starts_at)
    and not exists(select 1 from public.appointment_holds hold
      where hold.org_id=p_org_id and hold.branch_id=p_branch_id and hold.professional_id=candidate.pro_id
        and hold.status='active' and hold.expires_at>now()
        and (candidate.local_start at time zone v_timezone)<hold.ends_at
        and (candidate.local_end at time zone v_timezone)>hold.starts_at)
    and not exists(select 1 from public.branch_closures closure
      where closure.org_id=p_org_id and closure.branch_id=p_branch_id
        and (candidate.local_start at time zone v_timezone)<closure.ends_at
        and (candidate.local_end at time zone v_timezone)>closure.starts_at)
    and not exists(select 1 from public.professional_time_off time_off
      where time_off.org_id=p_org_id and time_off.professional_id=candidate.pro_id
        and (candidate.local_start at time zone v_timezone)<time_off.ends_at
        and (candidate.local_end at time zone v_timezone)>time_off.starts_at)
  order by 1,3;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_public_salon_catalog(p_slug text, p_branch_id uuid)
 RETURNS TABLE(org_id uuid, branch_id uuid, slug text, display_name text, description text, branch_name text, public_address text, neighborhood text, city text, state text, service_id uuid, service_name text, service_description text, category text, duration_minutes integer, price numeric, professional_id uuid, professional_name text, specialty text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select profile.org_id,branch_profile.branch_id,profile.slug,profile.display_name,profile.description,
    branch.name,branch_profile.public_address,branch_profile.neighborhood,branch_profile.city,
    branch_profile.state,service.id,service.name,service.description,service.category,
    service.duration_minutes,service.price,professional.id,professional.name,professional.specialty
  from public.salon_public_profiles profile
  join public.branch_public_profiles branch_profile on branch_profile.org_id=profile.org_id
    and branch_profile.is_published and (p_branch_id is null or branch_profile.branch_id=p_branch_id)
  join public.branches branch on branch.org_id=branch_profile.org_id
    and branch.id=branch_profile.branch_id and branch.active
  join public.services service on service.org_id=profile.org_id and service.active
    and (service.branch_id is null or service.branch_id=branch_profile.branch_id)
  join public.professional_services assignment on assignment.org_id=service.org_id
    and assignment.service_id=service.id
  join public.professionals professional on professional.org_id=assignment.org_id
    and professional.id=assignment.professional_id and professional.active
    and (professional.branch_id is null or professional.branch_id=branch_profile.branch_id)
  where profile.is_published and profile.slug=lower(btrim(p_slug));
$function$;
