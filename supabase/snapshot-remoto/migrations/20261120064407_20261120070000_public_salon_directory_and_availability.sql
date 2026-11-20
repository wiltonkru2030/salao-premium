-- SALÃO PREMIUM — vitrine pública, catálogo e consulta de horários.
-- Responsabilidade:
--   1. Permitir que owner/admin publiquem cada unidade separadamente.
--   2. Expor somente dados explicitamente publicados por RPCs públicas.
--   3. Consultar horários candidatos respeitando expediente, serviço, profissional,
--      agendamentos, bloqueios, afastamentos, fechamentos e HOLDs ativos.
-- Segurança:
--   - A tabela de publicação não concede leitura a anon.
--   - As RPCs públicas são SECURITY INVOKER e delegam a funções privadas.
--   - As funções privadas usam SECURITY DEFINER, search_path vazio e dados qualificados.
--   - A publicação é por unidade; não torna automaticamente todas as filiais públicas.

begin;

create table public.public_branch_profiles (
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  slug text not null,
  display_name text not null,
  description text,
  public_address text,
  neighborhood text,
  city text not null,
  state char(2) not null,
  latitude double precision,
  longitude double precision,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_branch_profiles_pk primary key (org_id, branch_id),
  constraint public_branch_profiles_branch_fk
    foreign key (org_id, branch_id) references public.branches(org_id, id) on delete cascade,
  constraint public_branch_profiles_slug_format
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint public_branch_profiles_display_name_length
    check (length(btrim(display_name)) between 2 and 120),
  constraint public_branch_profiles_city_length
    check (length(btrim(city)) between 2 and 100),
  constraint public_branch_profiles_state_format
    check (state ~ '^[A-Z]{2}$'),
  constraint public_branch_profiles_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint public_branch_profiles_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint public_branch_profiles_coordinates_pair
    check ((latitude is null) = (longitude is null))
);

comment on table public.public_branch_profiles is
  'Configuração da vitrine pública por filial. Uma unidade só aparece na busca quando published=true.';
comment on column public.public_branch_profiles.slug is
  'Identificador público estável e único usado no endereço da vitrine da unidade.';
comment on column public.public_branch_profiles.display_name is
  'Nome comercial apresentado na vitrine pública, sem expor dados cadastrais privados.';
comment on column public.public_branch_profiles.description is
  'Descrição pública escrita pelo salão; não deve conter dados pessoais sensíveis.';
comment on column public.public_branch_profiles.public_address is
  'Endereço autorizado para divulgação. Não é copiado automaticamente do cadastro privado da filial.';
comment on column public.public_branch_profiles.published is
  'Consentimento operacional explícito para listar esta unidade no diretório público.';

create unique index public_branch_profiles_slug_uidx
  on public.public_branch_profiles (slug);
create index public_branch_profiles_public_location_idx
  on public.public_branch_profiles (state, city)
  where published = true;
create index public_branch_profiles_org_published_idx
  on public.public_branch_profiles (org_id, published);

alter table public.public_branch_profiles enable row level security;
revoke all on public.public_branch_profiles from public, anon;
grant select, insert, update, delete on public.public_branch_profiles to authenticated;

drop policy if exists public_branch_profiles_admin_manage on public.public_branch_profiles;
create policy public_branch_profiles_admin_manage
  on public.public_branch_profiles
  for all to authenticated
  using ((select private.has_org_role(org_id, array['owner','admin']::text[])))
  with check ((select private.has_org_role(org_id, array['owner','admin']::text[])));

-- Pesquisa de unidades publicadas. Coordenadas são opcionais; sem elas, ordena por cidade/nome.
create or replace function private.search_public_salons(
  p_query text,
  p_city text,
  p_state text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision,
  p_limit integer
)
returns table (
  org_id uuid,
  branch_id uuid,
  slug text,
  display_name text,
  description text,
  branch_name text,
  public_address text,
  neighborhood text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    profile.org_id,
    profile.branch_id,
    profile.slug,
    profile.display_name,
    profile.description,
    branch.name as branch_name,
    profile.public_address,
    profile.neighborhood,
    profile.city,
    profile.state,
    profile.latitude,
    profile.longitude,
    case
      when p_latitude is null then null::double precision
      else 6371.0 * acos(least(1.0, greatest(-1.0,
        cos(radians(p_latitude)) * cos(radians(profile.latitude))
        * cos(radians(profile.longitude) - radians(p_longitude))
        + sin(radians(p_latitude)) * sin(radians(profile.latitude))
      )))
    end as distance_km
  from public.public_branch_profiles profile
  join public.branches branch
    on branch.org_id = profile.org_id and branch.id = profile.branch_id
  join public.organizations org on org.id = profile.org_id
  where profile.published = true
    and branch.active = true
    and (p_query is null or btrim(p_query) = ''
      or profile.display_name ilike '%' || btrim(p_query) || '%'
      or branch.name ilike '%' || btrim(p_query) || '%'
      or coalesce(profile.neighborhood, '') ilike '%' || btrim(p_query) || '%'
      or profile.city ilike '%' || btrim(p_query) || '%')
    and (p_city is null or profile.city ilike btrim(p_city))
    and (p_state is null or profile.state = upper(btrim(p_state)))
    and (
      p_latitude is null
      or (
        profile.latitude is not null and profile.longitude is not null
        and 6371.0 * acos(least(1.0, greatest(-1.0,
          cos(radians(p_latitude)) * cos(radians(profile.latitude))
          * cos(radians(profile.longitude) - radians(p_longitude))
          + sin(radians(p_latitude)) * sin(radians(profile.latitude))
        ))) <= greatest(1.0, least(coalesce(p_radius_km, 30), 200))
      )
    )
  order by
    case when p_latitude is not null then 0 else 1 end,
    distance_km asc nulls last,
    profile.city asc,
    profile.display_name asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$;

comment on function private.search_public_salons(text,text,text,double precision,double precision,double precision,integer) is
  'Pesquisa exclusivamente unidades publicadas, aplicando filtros de cidade/UF e distância sem expor tabelas operacionais.';

create or replace function public.search_public_salons(
  p_query text default null,
  p_city text default null,
  p_state text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_radius_km double precision default 30,
  p_limit integer default 30
)
returns table (
  org_id uuid,
  branch_id uuid,
  slug text,
  display_name text,
  description text,
  branch_name text,
  public_address text,
  neighborhood text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.search_public_salons(
    p_query, p_city, p_state, p_latitude, p_longitude, p_radius_km, p_limit
  );
$function$;

revoke all on function private.search_public_salons(text,text,text,double precision,double precision,double precision,integer) from public;
grant execute on function private.search_public_salons(text,text,text,double precision,double precision,double precision,integer) to anon, authenticated;
revoke all on function public.search_public_salons(text,text,text,double precision,double precision,double precision,integer) from public;
grant execute on function public.search_public_salons(text,text,text,double precision,double precision,double precision,integer) to anon, authenticated;

-- Catálogo público de uma unidade publicada; os profissionais são limitados aos serviços vinculados.
create or replace function private.get_public_salon_catalog(p_slug text, p_branch_id uuid)
returns table (
  org_id uuid,
  branch_id uuid,
  slug text,
  display_name text,
  description text,
  branch_name text,
  public_address text,
  neighborhood text,
  city text,
  state text,
  service_id uuid,
  service_name text,
  service_description text,
  category text,
  duration_minutes integer,
  price numeric,
  professional_id uuid,
  professional_name text,
  specialty text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    profile.org_id,
    profile.branch_id,
    profile.slug,
    profile.display_name,
    profile.description,
    branch.name as branch_name,
    profile.public_address,
    profile.neighborhood,
    profile.city,
    profile.state,
    service.id as service_id,
    service.name as service_name,
    service.description as service_description,
    service.category,
    service.duration_minutes,
    service.price,
    professional.id as professional_id,
    professional.name as professional_name,
    professional.specialty
  from public.public_branch_profiles profile
  join public.branches branch
    on branch.org_id = profile.org_id and branch.id = profile.branch_id and branch.active
  join public.services service
    on service.org_id = profile.org_id and service.active
  join public.professional_services assignment
    on assignment.org_id = service.org_id and assignment.service_id = service.id
  join public.professionals professional
    on professional.org_id = assignment.org_id
    and professional.id = assignment.professional_id
    and professional.active
    and (professional.branch_id is null or professional.branch_id = profile.branch_id)
  where profile.published = true
    and profile.slug = lower(btrim(p_slug))
    and (p_branch_id is null or profile.branch_id = p_branch_id);
$function$;

comment on function private.get_public_salon_catalog(text,uuid) is
  'Retorna serviços e profissionais ativos somente para a unidade publicada identificada pelo slug.';

create or replace function public.get_public_salon_catalog(
  p_slug text,
  p_branch_id uuid default null
)
returns table (
  org_id uuid,
  branch_id uuid,
  slug text,
  display_name text,
  description text,
  branch_name text,
  public_address text,
  neighborhood text,
  city text,
  state text,
  service_id uuid,
  service_name text,
  service_description text,
  category text,
  duration_minutes integer,
  price numeric,
  professional_id uuid,
  professional_name text,
  specialty text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_public_salon_catalog(p_slug, p_branch_id);
$function$;

revoke all on function private.get_public_salon_catalog(text,uuid) from public;
grant execute on function private.get_public_salon_catalog(text,uuid) to anon, authenticated;
revoke all on function public.get_public_salon_catalog(text,uuid) from public;
grant execute on function public.get_public_salon_catalog(text,uuid) to anon, authenticated;

-- Consulta horários em horário local da organização e converte o resultado para timestamptz.
-- Cada linha representa um profissional apto para aquele serviço e início de atendimento.
create or replace function private.get_customer_available_slots(
  p_org_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid,
  p_interval_minutes integer
)
returns table (
  starts_at timestamptz,
  professional_id uuid,
  professional_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_timezone text;
  v_duration integer;
  v_open boolean;
begin
  if p_org_id is null or p_branch_id is null or p_service_id is null or p_date is null then
    raise exception 'Informe salão, unidade, serviço e data.' using errcode = '22023';
  end if;
  if p_interval_minutes is null or p_interval_minutes < 5 or p_interval_minutes > 60 then
    raise exception 'O intervalo de consulta deve estar entre 5 e 60 minutos.' using errcode = '22023';
  end if;

  select org.timezone, service.duration_minutes
    into v_timezone, v_duration
  from public.public_branch_profiles profile
  join public.organizations org on org.id = profile.org_id
  join public.branches branch
    on branch.org_id = profile.org_id and branch.id = profile.branch_id and branch.active
  join public.services service
    on service.org_id = profile.org_id and service.id = p_service_id and service.active
  where profile.org_id = p_org_id
    and profile.branch_id = p_branch_id
    and profile.published = true;

  if not found then
    raise exception 'Esta unidade ou serviço não está publicado para agendamento.' using errcode = '22023';
  end if;

  if p_date < (now() at time zone v_timezone)::date then
    raise exception 'Escolha uma data de hoje em diante.' using errcode = '22023';
  end if;

  return query
  with eligible as (
    select distinct
      professional.id as pro_id,
      professional.name as pro_name,
      working.weekday,
      greatest(branch_hours.opens_at, working.starts_at) as local_open,
      least(branch_hours.closes_at, working.ends_at) as local_close
    from public.public_branch_profiles profile
    join public.branches branch
      on branch.org_id = profile.org_id and branch.id = profile.branch_id and branch.active
    join public.professionals professional
      on professional.org_id = profile.org_id
      and professional.active
      and (professional.branch_id is null or professional.branch_id = profile.branch_id)
    join public.professional_services assignment
      on assignment.org_id = professional.org_id
      and assignment.professional_id = professional.id
      and assignment.service_id = p_service_id
    join public.branch_business_hours branch_hours
      on branch_hours.org_id = profile.org_id
      and branch_hours.branch_id = profile.branch_id
      and branch_hours.weekday = extract(dow from p_date)::integer
      and branch_hours.active
    join public.professional_working_hours working
      on working.org_id = professional.org_id
      and working.professional_id = professional.id
      and working.weekday = extract(dow from p_date)::integer
      and working.active
    where profile.org_id = p_org_id
      and profile.branch_id = p_branch_id
      and profile.published = true
      and (p_professional_id is null or professional.id = p_professional_id)
      and greatest(branch_hours.opens_at, working.starts_at)
          < least(branch_hours.closes_at, working.ends_at)
  ),
  candidates as (
    select
      eligible.pro_id,
      eligible.pro_name,
      (p_date + generated.local_start)::timestamp as local_start,
      ((p_date + generated.local_start) + make_interval(mins => v_duration))::timestamp as local_end
    from eligible
    cross join lateral generate_series(
      (p_date + eligible.local_open)::timestamp,
      (p_date + eligible.local_close - make_interval(mins => v_duration))::timestamp,
      make_interval(mins => p_interval_minutes)
    ) as generated(local_start)
  )
  select
    (candidate.local_start at time zone v_timezone) as starts_at,
    candidate.pro_id as professional_id,
    candidate.pro_name as professional_name
  from candidates candidate
  where (candidate.local_start at time zone v_timezone) > now()
    and not exists (
      select 1 from public.appointments appointment
      where appointment.org_id = p_org_id
        and appointment.professional_id = candidate.pro_id
        and appointment.status not in ('cancelled','no_show')
        and (candidate.local_start at time zone v_timezone) < appointment.ends_at
        and (candidate.local_end at time zone v_timezone) > appointment.starts_at
    )
    and not exists (
      select 1 from public.appointment_blocks block
      where block.org_id = p_org_id
        and (block.professional_id is null or block.professional_id = candidate.pro_id)
        and (block.branch_id is null or block.branch_id = p_branch_id)
        and (candidate.local_start at time zone v_timezone) < block.ends_at
        and (candidate.local_end at time zone v_timezone) > block.starts_at
    )
    and not exists (
      select 1 from public.appointment_holds hold
      where hold.org_id = p_org_id
        and hold.branch_id = p_branch_id
        and hold.professional_id = candidate.pro_id
        and hold.status = 'active'
        and hold.expires_at > now()
        and (candidate.local_start at time zone v_timezone) < hold.ends_at
        and (candidate.local_end at time zone v_timezone) > hold.starts_at
    )
    and not exists (
      select 1 from public.branch_closures closure
      where closure.org_id = p_org_id
        and closure.branch_id = p_branch_id
        and (candidate.local_start at time zone v_timezone) < closure.ends_at
        and (candidate.local_end at time zone v_timezone) > closure.starts_at
    )
    and not exists (
      select 1 from public.professional_time_off time_off
      where time_off.org_id = p_org_id
        and time_off.professional_id = candidate.pro_id
        and (candidate.local_start at time zone v_timezone) < time_off.ends_at
        and (candidate.local_end at time zone v_timezone) > time_off.starts_at
    )
  order by starts_at, professional_name;
end;
$function$;

comment on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) is
  'Calcula horários candidatos respeitando expediente local, duração do serviço e todos os conflitos operacionais.';

create or replace function public.get_customer_available_slots(
  p_org_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null,
  p_interval_minutes integer default 15
)
returns table (
  starts_at timestamptz,
  professional_id uuid,
  professional_name text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_customer_available_slots(
    p_org_id, p_branch_id, p_service_id, p_date, p_professional_id, p_interval_minutes
  );
$function$;

revoke all on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) from public;
grant execute on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to anon, authenticated;
revoke all on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) from public;
grant execute on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to anon, authenticated;

commit;
