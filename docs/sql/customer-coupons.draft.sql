-- RASCUNHO — cupons públicos com reserva transacional vinculada ao HOLD de agendamento.
-- Não aplicar em produção sem revisão e autorização explícita.
-- Cada reserva do app da cliente aplica o cupom a um único serviço; o backend recalcula e reserva o uso.

begin;

grant usage on schema private to authenticated;

create table if not exists public.salon_coupons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  discount_type text not null,
  discount_value numeric(10,2) not null,
  max_discount_amount numeric(10,2),
  minimum_amount numeric(10,2) not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  usage_limit integer,
  usage_per_customer integer not null default 1,
  active boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_coupons_code_format check (code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint salon_coupons_title_length check (length(btrim(title)) between 2 and 120),
  constraint salon_coupons_description_length check (description is null or length(description)<=500),
  constraint salon_coupons_discount_type check (discount_type in ('percent','fixed')),
  constraint salon_coupons_discount_value check (
    discount_value>0 and (discount_type<>'percent' or discount_value<=100)
  ),
  constraint salon_coupons_amounts check (
    minimum_amount>=0 and (max_discount_amount is null or max_discount_amount>0)
  ),
  constraint salon_coupons_dates check (ends_at>starts_at),
  constraint salon_coupons_usage check (
    (usage_limit is null or usage_limit>0) and usage_per_customer>0
  )
);

create unique index if not exists salon_coupons_org_code_unique
  on public.salon_coupons(org_id,upper(code));
create index if not exists salon_coupons_active_window_idx
  on public.salon_coupons(org_id,active,starts_at,ends_at);

create table if not exists public.salon_coupon_services (
  org_id uuid not null references public.organizations(id) on delete cascade,
  coupon_id uuid not null references public.salon_coupons(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coupon_id,service_id)
);

create table if not exists public.customer_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  coupon_id uuid not null references public.salon_coupons(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  hold_id uuid references public.appointment_holds(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  original_amount numeric(12,2) not null,
  discount_amount numeric(12,2) not null,
  final_amount numeric(12,2) not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint customer_coupon_redemptions_status check (status in ('reserved','redeemed','released')),
  constraint customer_coupon_redemptions_amounts check (
    original_amount>=0 and discount_amount>=0 and final_amount>=0
    and discount_amount<=original_amount
    and final_amount=original_amount-discount_amount
  )
);

create unique index if not exists customer_coupon_redemptions_hold_unique
  on public.customer_coupon_redemptions(hold_id) where hold_id is not null;
create unique index if not exists customer_coupon_redemptions_appointment_unique
  on public.customer_coupon_redemptions(appointment_id) where appointment_id is not null;
create index if not exists customer_coupon_redemptions_coupon_status_idx
  on public.customer_coupon_redemptions(coupon_id,status,created_at);

alter table public.appointment_holds
  add column if not exists coupon_id uuid references public.salon_coupons(id) on delete set null,
  add column if not exists coupon_discount_amount numeric(12,2) not null default 0,
  add column if not exists coupon_final_amount numeric(12,2),
  add column if not exists coupon_code_snapshot text;

alter table public.appointment_holds
  drop constraint if exists appointment_holds_coupon_discount_nonnegative;
alter table public.appointment_holds
  add constraint appointment_holds_coupon_discount_nonnegative
  check (coupon_discount_amount>=0 and (coupon_final_amount is null or coupon_final_amount>=0));

alter table public.salon_coupons enable row level security;
alter table public.salon_coupon_services enable row level security;
alter table public.customer_coupon_redemptions enable row level security;

revoke all on public.salon_coupons,public.salon_coupon_services,public.customer_coupon_redemptions from public,anon;
grant select,insert,update,delete on public.salon_coupons,public.salon_coupon_services to authenticated;
grant select on public.customer_coupon_redemptions to authenticated;

drop policy if exists salon_coupons_admin_all on public.salon_coupons;
create policy salon_coupons_admin_all on public.salon_coupons
  for all to authenticated using (private.is_org_admin(org_id))
  with check (private.is_org_admin(org_id));

drop policy if exists salon_coupon_services_admin_all on public.salon_coupon_services;
create policy salon_coupon_services_admin_all on public.salon_coupon_services
  for all to authenticated using (
    private.is_org_admin(org_id) and exists (
      select 1 from public.salon_coupons c
      where c.id=coupon_id and c.org_id=salon_coupon_services.org_id
    )
  )
  with check (
    private.is_org_admin(org_id) and exists (
      select 1 from public.salon_coupons c
      where c.id=coupon_id and c.org_id=salon_coupon_services.org_id
    ) and exists (
      select 1 from public.services s
      where s.id=service_id and s.org_id=salon_coupon_services.org_id
    )
  );

drop policy if exists customer_coupon_redemptions_admin_select on public.customer_coupon_redemptions;
create policy customer_coupon_redemptions_admin_select on public.customer_coupon_redemptions
  for select to authenticated using (private.is_org_admin(org_id));

/**
 * Calculates coupon eligibility and discount without reserving usage.
 * The create-HOLD RPC locks the coupon row and repeats this calculation atomically.
 */
create or replace function private.compute_customer_coupon(
  p_org_id uuid,p_branch_id uuid,p_service_id uuid,p_coupon_code text
)
returns table (
  coupon_id uuid,
  code text,
  title text,
  discount_type text,
  discount_value numeric,
  original_amount numeric,
  discount_amount numeric,
  final_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
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
  where s.org_id=p_org_id and s.id=p_service_id and s.active;

  if not found then raise exception 'O serviço selecionado não está mais disponível.' using errcode='22023'; end if;
  if v_price<v_coupon.minimum_amount then raise exception 'O serviço não atinge o valor mínimo deste cupom.' using errcode='22023'; end if;

  if exists(select 1 from public.salon_coupon_services cs where cs.org_id=p_org_id and cs.coupon_id=v_coupon.id)
     and not exists(select 1 from public.salon_coupon_services cs where cs.org_id=p_org_id and cs.coupon_id=v_coupon.id and cs.service_id=p_service_id) then
    raise exception 'Este cupom não é válido para o serviço selecionado.' using errcode='22023';
  end if;

  select count(*) into v_usage
  from public.customer_coupon_redemptions r
  left join public.appointment_holds h on h.id=r.hold_id
  where r.coupon_id=v_coupon.id
    and (r.status='redeemed' or (r.status='reserved' and h.status='active' and h.expires_at>now()));

  if v_coupon.usage_limit is not null and v_usage>=v_coupon.usage_limit then
    raise exception 'Este cupom atingiu o limite de utilizações.' using errcode='22023';
  end if;

  select count(*) into v_user_usage
  from public.customer_coupon_redemptions r
  left join public.appointment_holds h on h.id=r.hold_id
  where r.coupon_id=v_coupon.id and r.auth_user_id=v_user
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

revoke all on function private.compute_customer_coupon(uuid,uuid,uuid,text) from public,anon;
grant execute on function private.compute_customer_coupon(uuid,uuid,uuid,text) to authenticated;

create or replace function public.validate_public_coupon(
  p_org_id uuid,p_branch_id uuid,p_service_id uuid,p_coupon_code text
)
returns table (
  coupon_id uuid,code text,title text,discount_type text,discount_value numeric,
  original_amount numeric,discount_amount numeric,final_amount numeric
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.compute_customer_coupon(p_org_id,p_branch_id,p_service_id,p_coupon_code);
$function$;

revoke all on function public.validate_public_coupon(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.validate_public_coupon(uuid,uuid,uuid,text) to authenticated;

create or replace function private.create_customer_appointment_hold_with_coupon(
  p_org_id uuid,p_branch_id uuid,p_professional_id uuid,p_service_id uuid,
  p_starts_at timestamptz,p_coupon_code text default null
)
returns table (
  hold_id uuid,expires_at timestamptz,coupon_id uuid,
  coupon_discount_amount numeric,coupon_final_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_coupon public.salon_coupons%rowtype;
  v_calc record;
  v_hold_id uuid;
  v_expires timestamptz;
  v_price numeric(12,2);
begin
  if v_user is null then raise exception 'Entre na sua conta para reservar um horário.' using errcode='42501'; end if;

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
    where s.org_id=p_org_id and s.id=p_service_id and s.active;
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

revoke all on function private.create_customer_appointment_hold_with_coupon(uuid,uuid,uuid,uuid,timestamptz,text) from public,anon;
grant execute on function private.create_customer_appointment_hold_with_coupon(uuid,uuid,uuid,uuid,timestamptz,text) to authenticated;

create or replace function public.create_customer_appointment_hold_with_coupon(
  p_org_id uuid,p_branch_id uuid,p_professional_id uuid,p_service_id uuid,
  p_starts_at timestamptz,p_coupon_code text default null
)
returns table (
  hold_id uuid,expires_at timestamptz,coupon_id uuid,
  coupon_discount_amount numeric,coupon_final_amount numeric
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.create_customer_appointment_hold_with_coupon(
    p_org_id,p_branch_id,p_professional_id,p_service_id,p_starts_at,p_coupon_code
  );
$function$;

revoke all on function public.create_customer_appointment_hold_with_coupon(uuid,uuid,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.create_customer_appointment_hold_with_coupon(uuid,uuid,uuid,uuid,timestamptz,text) to authenticated;

create or replace function private.confirm_customer_appointment_hold_with_coupon(p_hold_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_hold public.appointment_holds%rowtype;
  v_appointment_id uuid;
begin
  select * into v_hold from public.appointment_holds h
  where h.id=p_hold_id and h.auth_user_id=v_user for update;
  if not found then raise exception 'Reserva não encontrada para esta conta.' using errcode='42501'; end if;

  v_appointment_id:=private.confirm_customer_appointment_hold(p_hold_id);

  if v_hold.coupon_id is not null then
    update public.appointments
       set price=v_hold.coupon_final_amount
     where id=v_appointment_id and org_id=v_hold.org_id;

    update public.customer_coupon_redemptions
       set status='redeemed',appointment_id=v_appointment_id,redeemed_at=now()
     where hold_id=v_hold.id and auth_user_id=v_user and status='reserved';
  end if;
  return v_appointment_id;
end;
$function$;

revoke all on function private.confirm_customer_appointment_hold_with_coupon(uuid) from public,anon;
grant execute on function private.confirm_customer_appointment_hold_with_coupon(uuid) to authenticated;

create or replace function public.confirm_customer_appointment_hold_with_coupon(p_hold_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.confirm_customer_appointment_hold_with_coupon(p_hold_id);
$function$;

revoke all on function public.confirm_customer_appointment_hold_with_coupon(uuid) from public,anon,authenticated;
grant execute on function public.confirm_customer_appointment_hold_with_coupon(uuid) to authenticated;

create or replace function private.release_coupon_reservation_on_hold_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status in ('cancelled','expired') and old.status='active' then
    update public.customer_coupon_redemptions
       set status='released'
     where hold_id=new.id and status='reserved';
  end if;
  return new;
end;
$function$;

drop trigger if exists appointment_hold_release_coupon_trigger on public.appointment_holds;
create trigger appointment_hold_release_coupon_trigger
  after update of status on public.appointment_holds
  for each row execute function private.release_coupon_reservation_on_hold_end();

create or replace function private.cancel_customer_appointment_hold_with_coupon(p_hold_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select private.cancel_customer_appointment_hold(p_hold_id);
$function$;

revoke all on function private.cancel_customer_appointment_hold_with_coupon(uuid) from public,anon;
grant execute on function private.cancel_customer_appointment_hold_with_coupon(uuid) to authenticated;

create or replace function public.cancel_customer_appointment_hold_with_coupon(p_hold_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.cancel_customer_appointment_hold_with_coupon(p_hold_id);
$function$;

revoke all on function public.cancel_customer_appointment_hold_with_coupon(uuid) from public,anon,authenticated;
grant execute on function public.cancel_customer_appointment_hold_with_coupon(uuid) to authenticated;

comment on table public.salon_coupons is
  'Cupons de desconto configurados por salão, com validade, limites e escopo por filial/serviço.';
comment on table public.customer_coupon_redemptions is
  'Reserva e resgate transacional de cupons vinculados ao HOLD e ao agendamento confirmado.';

commit;
