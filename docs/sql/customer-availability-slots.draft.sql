-- RASCUNHO SUPERSEDED — histórico da consulta de disponibilidade.
-- NÃO EXECUTAR: a RPC oficial está aplicada em 20261120064407_public_salon_directory_and_availability.sql e alinhada pelas migrations seguintes.
-- Este arquivo não representa o contrato ativo; use as migrations versionadas e os testes correspondentes.
-- Não aplicar em produção sem revisão e autorização explícita.
-- A consulta não cria HOLD; create_customer_appointment_hold revalida conflitos.

begin;

grant usage on schema private to authenticated;

create or replace function private.get_customer_available_slots(
  p_org_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null,
  p_interval_minutes integer default 15
)
returns table (
  professional_id uuid,
  professional_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  price numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_timezone text;
  v_duration integer;
  v_weekday integer;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para consultar horários.' using errcode = '42501';
  end if;
  if p_org_id is null or p_branch_id is null or p_service_id is null or p_date is null then
    raise exception 'Selecione salão, unidade, serviço e data.' using errcode = '22023';
  end if;
  if p_interval_minutes is null or p_interval_minutes < 5 or p_interval_minutes > 60 then
    raise exception 'Intervalo de horários inválido.' using errcode = '22023';
  end if;

  select o.timezone, s.duration_minutes
    into v_timezone, v_duration
  from public.organizations o
  join public.branches b on b.org_id = o.id and b.id = p_branch_id and b.active
  join public.services s on s.org_id = o.id and s.id = p_service_id and s.active
  where o.id = p_org_id;

  if not found then
    raise exception 'Salão, unidade ou serviço indisponível.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.salon_public_profiles sp
    join public.branch_public_profiles bp
      on bp.org_id=sp.org_id and bp.branch_id=p_branch_id and bp.is_published
    where sp.org_id=p_org_id and sp.is_published
  ) then
    raise exception 'Este salão ou unidade não está publicado para agendamento.' using errcode='22023';
  end if;
  if p_date < (pg_catalog.now() at time zone v_timezone)::date then
    raise exception 'Escolha uma data atual ou futura.' using errcode = '22023';
  end if;

  v_weekday := extract(dow from p_date)::integer;

  return query
  with eligible as (
    select distinct
      p.id as pro_id,
      p.name as pro_name,
      s.price as service_price,
      p_date + greatest(bh.opens_at, ph.starts_at) as local_open,
      p_date + least(bh.closes_at, ph.ends_at) as local_close
    from public.professionals p
    join public.professional_services ps
      on ps.org_id = p.org_id and ps.professional_id = p.id and ps.service_id = p_service_id
    join public.services s on s.org_id = p.org_id and s.id = ps.service_id and s.active
    join public.branch_business_hours bh
      on bh.org_id = p.org_id and bh.branch_id = p_branch_id
     and bh.weekday = v_weekday and bh.active
    join public.professional_working_hours ph
      on ph.org_id = p.org_id and ph.professional_id = p.id
     and ph.weekday = v_weekday and ph.active
    where p.org_id = p_org_id
      and p.active
      and (p_professional_id is null or p.id = p_professional_id)
      and (p.branch_id is null or p.branch_id = p_branch_id)
      and greatest(bh.opens_at, ph.starts_at) < least(bh.closes_at, ph.ends_at)
  ),
  candidate_slots as (
    select
      e.pro_id,
      e.pro_name,
      e.service_price,
      slot.local_start at time zone v_timezone as slot_start,
      (slot.local_start + pg_catalog.make_interval(mins => v_duration)) at time zone v_timezone as slot_end
    from eligible e
    cross join lateral pg_catalog.generate_series(
      e.local_open,
      e.local_close - pg_catalog.make_interval(mins => v_duration),
      pg_catalog.make_interval(mins => p_interval_minutes)
    ) as slot(local_start)
  )
  select distinct c.pro_id, c.pro_name, c.slot_start, c.slot_end, c.service_price
  from candidate_slots c
  where c.slot_start > pg_catalog.now()
    and not exists (
      select 1 from public.appointments a
      where a.org_id = p_org_id and a.professional_id = c.pro_id
        and a.status not in ('cancelled','no_show')
        and c.slot_start < a.ends_at and c.slot_end > a.starts_at
    )
    and not exists (
      select 1 from public.appointment_blocks block
      where block.org_id = p_org_id
        and (block.branch_id is null or block.branch_id = p_branch_id)
        and (block.professional_id is null or block.professional_id = c.pro_id)
        and c.slot_start < block.ends_at and c.slot_end > block.starts_at
    )
    and not exists (
      select 1 from public.branch_closures closure
      where closure.org_id = p_org_id and closure.branch_id = p_branch_id
        and c.slot_start < closure.ends_at and c.slot_end > closure.starts_at
    )
    and not exists (
      select 1 from public.professional_time_off time_off
      where time_off.org_id = p_org_id and time_off.professional_id = c.pro_id
        and c.slot_start < time_off.ends_at and c.slot_end > time_off.starts_at
    )
    and not exists (
      select 1 from public.appointment_holds hold
      where hold.org_id = p_org_id and hold.professional_id = c.pro_id
        and hold.status = 'active' and hold.expires_at > pg_catalog.now()
        and c.slot_start < hold.ends_at and c.slot_end > hold.starts_at
    )
  order by c.slot_start, c.pro_name;
end;
$function$;

revoke all on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) from public, anon;
grant execute on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to authenticated;

create or replace function public.get_customer_available_slots(
  p_org_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null,
  p_interval_minutes integer default 15
)
returns table (
  professional_id uuid,
  professional_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  price numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_customer_available_slots(
    p_org_id,p_branch_id,p_service_id,p_date,p_professional_id,p_interval_minutes
  );
$function$;

revoke all on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) from public, anon, authenticated;
grant execute on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to authenticated;

comment on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) is
  'Consulta horários candidatos com expediente, folgas, fechamentos, bloqueios, agenda e HOLDs; a criação do HOLD revalida tudo em transação.';

commit;
