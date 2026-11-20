-- SALÃO PREMIUM — compatibilidade da vitrine pública com Configurações.
-- Responsabilidade:
--   - Separar identidade pública da marca (salon_public_profiles) dos dados públicos da filial
--     (branch_public_profiles), conforme o formulário já existente em src/pages/settings.js.
--   - Salvar ambas as partes atomicamente por RPC autenticada.
--   - Fazer diretório, catálogo e disponibilidade exigirem publicação da marca e da filial.
-- Segurança:
--   - RLS owner/admin nas duas tabelas; anon não recebe acesso direto.
--   - RPC pública SECURITY INVOKER; implementação privilegiada em private com auth.uid().
--   - Nenhum endereço ou contato privado é copiado automaticamente para a vitrine.

begin;

-- A estrutura inicial desta etapa foi substituída antes de receber dados de clientes.
drop function if exists public.search_public_salons(text,text,text,double precision,double precision,double precision,integer);
drop function if exists private.search_public_salons(text,text,text,double precision,double precision,double precision,integer);
drop function if exists public.get_public_salon_catalog(text,uuid);
drop function if exists private.get_public_salon_catalog(text,uuid);
drop function if exists public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer);
drop function if exists private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer);
drop table if exists public.public_branch_profiles;

create table public.salon_public_profiles (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  description text,
  logo_url text,
  cover_image_url text,
  public_phone text,
  website_url text,
  instagram_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_public_profiles_slug_format
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint salon_public_profiles_display_name_length
    check (length(btrim(display_name)) between 2 and 120),
  constraint salon_public_profiles_description_length
    check (description is null or length(description) <= 1000),
  constraint salon_public_profiles_logo_https
    check (logo_url is null or logo_url ~ '^https://'),
  constraint salon_public_profiles_cover_https
    check (cover_image_url is null or cover_image_url ~ '^https://'),
  constraint salon_public_profiles_website_https
    check (website_url is null or website_url ~ '^https://'),
  constraint salon_public_profiles_instagram_https
    check (instagram_url is null or instagram_url ~ '^https://')
);

comment on table public.salon_public_profiles is
  'Perfil público da marca/organização. Só é exibido quando is_published=true e há filial publicada.';
comment on column public.salon_public_profiles.slug is
  'Slug público global e único da marca, usado na URL de descoberta do salão.';
comment on column public.salon_public_profiles.is_published is
  'Consentimento explícito para divulgar os dados públicos da marca.';

create table public.branch_public_profiles (
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  public_address text,
  neighborhood text,
  city text not null,
  state char(2) not null,
  postal_code text,
  public_phone text,
  latitude double precision,
  longitude double precision,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_public_profiles_pk primary key (org_id, branch_id),
  constraint branch_public_profiles_branch_fk
    foreign key (org_id, branch_id) references public.branches(org_id,id) on delete cascade,
  constraint branch_public_profiles_city_length
    check (length(btrim(city)) between 2 and 100),
  constraint branch_public_profiles_state_format
    check (state ~ '^[A-Z]{2}$'),
  constraint branch_public_profiles_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint branch_public_profiles_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint branch_public_profiles_coordinates_pair
    check ((latitude is null) = (longitude is null))
);

comment on table public.branch_public_profiles is
  'Dados de endereço e localização que cada filial autorizou divulgar publicamente.';
comment on column public.branch_public_profiles.public_address is
  'Endereço fornecido para divulgação; não é preenchido automaticamente com o endereço cadastral privado.';
comment on column public.branch_public_profiles.is_published is
  'Consentimento explícito para listar esta unidade no diretório público.';

create index branch_public_profiles_public_location_idx
  on public.branch_public_profiles(state, city)
  where is_published = true;

alter table public.salon_public_profiles enable row level security;
alter table public.branch_public_profiles enable row level security;
revoke all on public.salon_public_profiles, public.branch_public_profiles from public, anon;
grant select, insert, update, delete on public.salon_public_profiles, public.branch_public_profiles to authenticated;

drop policy if exists salon_public_profiles_admin_manage on public.salon_public_profiles;
create policy salon_public_profiles_admin_manage
  on public.salon_public_profiles for all to authenticated
  using ((select private.has_org_role(org_id, array['owner','admin']::text[])))
  with check ((select private.has_org_role(org_id, array['owner','admin']::text[])));

drop policy if exists branch_public_profiles_admin_manage on public.branch_public_profiles;
create policy branch_public_profiles_admin_manage
  on public.branch_public_profiles for all to authenticated
  using ((select private.has_org_role(org_id, array['owner','admin']::text[])))
  with check ((select private.has_org_role(org_id, array['owner','admin']::text[])));

-- RPC transacional chamada pelo formulário real de Configurações.
create or replace function private.save_public_salon_profile(
  p_org_id uuid,
  p_branch_id uuid,
  p_slug text,
  p_display_name text,
  p_description text,
  p_logo_url text,
  p_cover_image_url text,
  p_public_phone text,
  p_website_url text,
  p_instagram_url text,
  p_is_published boolean,
  p_public_address text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_branch_public_phone text,
  p_branch_is_published boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Entre na sua conta para configurar a vitrine.' using errcode = '42501';
  end if;
  if not private.has_org_role(p_org_id, array['owner','admin']::text[]) then
    raise exception 'Somente proprietário ou administrador pode publicar a vitrine.' using errcode = '42501';
  end if;
  if p_org_id is null or p_branch_id is null then
    raise exception 'Selecione a organização e a unidade.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.org_id = p_org_id and b.id = p_branch_id and b.active
  ) then
    raise exception 'A unidade selecionada não existe ou está inativa.' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 80 then
    raise exception 'O endereço público deve usar letras minúsculas, números e hífens.' using errcode = '22023';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 2 and 120 then
    raise exception 'Informe um nome público entre 2 e 120 caracteres.' using errcode = '22023';
  end if;
  if p_city is null or length(btrim(p_city)) not between 2 and 100
     or p_state is null or upper(p_state) !~ '^[A-Z]{2}$' then
    raise exception 'Informe uma cidade e uma UF válidas.' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or (p_latitude is not null and (p_latitude < -90 or p_latitude > 90
         or p_longitude < -180 or p_longitude > 180)) then
    raise exception 'Informe latitude e longitude válidas juntas.' using errcode = '22023';
  end if;
  if coalesce(p_description,'') <> '' and length(p_description) > 1000 then
    raise exception 'A descrição pública ultrapassou 1.000 caracteres.' using errcode = '22023';
  end if;
  if (p_logo_url is not null and p_logo_url !~ '^https://')
     or (p_cover_image_url is not null and p_cover_image_url !~ '^https://')
     or (p_website_url is not null and p_website_url !~ '^https://')
     or (p_instagram_url is not null and p_instagram_url !~ '^https://') then
    raise exception 'Os links públicos devem utilizar HTTPS.' using errcode = '22023';
  end if;

  insert into public.salon_public_profiles(
    org_id,slug,display_name,description,logo_url,cover_image_url,
    public_phone,website_url,instagram_url,is_published,updated_at
  ) values (
    p_org_id,lower(p_slug),btrim(p_display_name),nullif(btrim(p_description),''),
    nullif(btrim(p_logo_url),''),nullif(btrim(p_cover_image_url),''),
    nullif(btrim(p_public_phone),''),nullif(btrim(p_website_url),''),
    nullif(btrim(p_instagram_url),''),coalesce(p_is_published,false),now()
  )
  on conflict (org_id) do update set
    slug=excluded.slug,
    display_name=excluded.display_name,
    description=excluded.description,
    logo_url=excluded.logo_url,
    cover_image_url=excluded.cover_image_url,
    public_phone=excluded.public_phone,
    website_url=excluded.website_url,
    instagram_url=excluded.instagram_url,
    is_published=excluded.is_published,
    updated_at=now();

  insert into public.branch_public_profiles(
    org_id,branch_id,public_address,neighborhood,city,state,postal_code,
    public_phone,latitude,longitude,is_published,updated_at
  ) values (
    p_org_id,p_branch_id,nullif(btrim(p_public_address),''),nullif(btrim(p_neighborhood),''),
    btrim(p_city),upper(btrim(p_state)),nullif(btrim(p_postal_code),''),
    nullif(btrim(p_branch_public_phone),''),p_latitude,p_longitude,
    coalesce(p_branch_is_published,false),now()
  )
  on conflict (org_id,branch_id) do update set
    public_address=excluded.public_address,
    neighborhood=excluded.neighborhood,
    city=excluded.city,
    state=excluded.state,
    postal_code=excluded.postal_code,
    public_phone=excluded.public_phone,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    is_published=excluded.is_published,
    updated_at=now();

  insert into public.audit_logs(org_id,actor_id,action,entity_type,entity_id,metadata)
  values (
    p_org_id,v_actor,'public_salon_profile_saved','salon_public_profiles',p_org_id,
    jsonb_build_object('branch_id',p_branch_id,'salon_published',coalesce(p_is_published,false),
      'branch_published',coalesce(p_branch_is_published,false),'slug',lower(p_slug))
  );
  return true;
exception
  when unique_violation then
    raise exception 'Este endereço público já está sendo utilizado por outro salão.' using errcode = '23505';
end;
$function$;

comment on function private.save_public_salon_profile(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,double precision,double precision,text,boolean) is
  'Salva perfil da marca e perfil público da filial em uma transação, exigindo owner/admin da organização.';

create or replace function public.save_public_salon_profile(
  p_org_id uuid,
  p_branch_id uuid,
  p_slug text,
  p_display_name text,
  p_description text,
  p_logo_url text,
  p_cover_image_url text,
  p_public_phone text,
  p_website_url text,
  p_instagram_url text,
  p_is_published boolean,
  p_public_address text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_branch_public_phone text,
  p_branch_is_published boolean
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.save_public_salon_profile(
    p_org_id,p_branch_id,p_slug,p_display_name,p_description,p_logo_url,p_cover_image_url,
    p_public_phone,p_website_url,p_instagram_url,p_is_published,p_public_address,p_neighborhood,
    p_city,p_state,p_postal_code,p_latitude,p_longitude,p_branch_public_phone,p_branch_is_published
  );
$function$;

revoke all on function private.save_public_salon_profile(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,double precision,double precision,text,boolean) from public, anon;
grant execute on function private.save_public_salon_profile(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,double precision,double precision,text,boolean) to authenticated;
revoke all on function public.save_public_salon_profile(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,double precision,double precision,text,boolean) from public, anon;
grant execute on function public.save_public_salon_profile(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,double precision,double precision,text,boolean) to authenticated;

-- Pesquisa: somente marca publicada e filial publicada/ativa.
create or replace function private.search_public_salons(
  p_query text,p_city text,p_state text,p_latitude double precision,p_longitude double precision,
  p_radius_km double precision,p_limit integer
)
returns table (
  org_id uuid,branch_id uuid,slug text,display_name text,description text,branch_name text,
  public_address text,neighborhood text,city text,state text,latitude double precision,
  longitude double precision,distance_km double precision
)
language sql stable security definer set search_path = ''
as $function$
  select profile.org_id, branch_profile.branch_id, profile.slug, profile.display_name,
    profile.description, branch.name, branch_profile.public_address, branch_profile.neighborhood,
    branch_profile.city, branch_profile.state, branch_profile.latitude, branch_profile.longitude,
    case when p_latitude is null then null::double precision else
      6371.0 * acos(least(1.0,greatest(-1.0,
        cos(radians(p_latitude))*cos(radians(branch_profile.latitude))
        *cos(radians(branch_profile.longitude)-radians(p_longitude))
        +sin(radians(p_latitude))*sin(radians(branch_profile.latitude))
      ))) end
  from public.salon_public_profiles profile
  join public.branch_public_profiles branch_profile on branch_profile.org_id=profile.org_id
  join public.branches branch on branch.org_id=branch_profile.org_id
    and branch.id=branch_profile.branch_id and branch.active
  where profile.is_published and branch_profile.is_published
    and (p_query is null or btrim(p_query)='' or profile.display_name ilike '%'||btrim(p_query)||'%'
      or branch.name ilike '%'||btrim(p_query)||'%'
      or coalesce(branch_profile.neighborhood,'') ilike '%'||btrim(p_query)||'%'
      or branch_profile.city ilike '%'||btrim(p_query)||'%')
    and (p_city is null or branch_profile.city ilike btrim(p_city))
    and (p_state is null or branch_profile.state=upper(btrim(p_state)))
    and (p_latitude is null or (
      branch_profile.latitude is not null and branch_profile.longitude is not null
      and 6371.0*acos(least(1.0,greatest(-1.0,
        cos(radians(p_latitude))*cos(radians(branch_profile.latitude))
        *cos(radians(branch_profile.longitude)-radians(p_longitude))
        +sin(radians(p_latitude))*sin(radians(branch_profile.latitude))
      ))) <= least(200.0,greatest(0.1,coalesce(p_radius_km,30)))
    ))
  order by case when p_latitude is not null then 0 else 1 end,
    case when p_latitude is null then null::double precision else
      6371.0*acos(least(1.0,greatest(-1.0,
        cos(radians(p_latitude))*cos(radians(branch_profile.latitude))
        *cos(radians(branch_profile.longitude)-radians(p_longitude))
        +sin(radians(p_latitude))*sin(radians(branch_profile.latitude))
      ))) end asc nulls last,
    branch_profile.city,profile.display_name
  limit least(100,greatest(1,coalesce(p_limit,30)));
$function$;

create or replace function public.search_public_salons(
  p_query text default null,p_city text default null,p_state text default null,
  p_latitude double precision default null,p_longitude double precision default null,
  p_radius_km double precision default 30,p_limit integer default 30
)
returns table (
  org_id uuid,branch_id uuid,slug text,display_name text,description text,branch_name text,
  public_address text,neighborhood text,city text,state text,latitude double precision,
  longitude double precision,distance_km double precision
)
language plpgsql stable security invoker set search_path = ''
as $function$
begin
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Informe latitude e longitude juntas.' using errcode='22023';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then
    raise exception 'A localização informada é inválida.' using errcode='22023';
  end if;
  if p_radius_km is null or p_radius_km <= 0 or p_radius_km > 200 then
    raise exception 'O raio de busca deve estar entre 0 e 200 km.' using errcode='22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'A quantidade de resultados deve estar entre 1 e 100.' using errcode='22023';
  end if;
  if length(coalesce(p_query,'')) > 120 or length(coalesce(p_city,'')) > 100
     or length(coalesce(p_state,'')) > 2 then
    raise exception 'Um dos filtros de busca ultrapassou o tamanho permitido.' using errcode='22023';
  end if;
  return query select * from private.search_public_salons(
    p_query,p_city,p_state,p_latitude,p_longitude,p_radius_km,p_limit
  );
end;
$function$;

revoke all on function private.search_public_salons(text,text,text,double precision,double precision,double precision,integer) from public;
grant execute on function private.search_public_salons(text,text,text,double precision,double precision,double precision,integer) to anon,authenticated;
revoke all on function public.search_public_salons(text,text,text,double precision,double precision,double precision,integer) from public;
grant execute on function public.search_public_salons(text,text,text,double precision,double precision,double precision,integer) to anon,authenticated;

-- Catálogo: serviços ativos e profissionais ativos habilitados para cada serviço e filial.
create or replace function private.get_public_salon_catalog(p_slug text,p_branch_id uuid)
returns table (
  org_id uuid,branch_id uuid,slug text,display_name text,description text,branch_name text,
  public_address text,neighborhood text,city text,state text,service_id uuid,service_name text,
  service_description text,category text,duration_minutes integer,price numeric,
  professional_id uuid,professional_name text,specialty text
)
language sql stable security definer set search_path = ''
as $function$
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
  join public.professional_services assignment on assignment.org_id=service.org_id
    and assignment.service_id=service.id
  join public.professionals professional on professional.org_id=assignment.org_id
    and professional.id=assignment.professional_id and professional.active
    and (professional.branch_id is null or professional.branch_id=branch_profile.branch_id)
  where profile.is_published and profile.slug=lower(btrim(p_slug));
$function$;

create or replace function public.get_public_salon_catalog(p_slug text,p_branch_id uuid default null)
returns table (
  org_id uuid,branch_id uuid,slug text,display_name text,description text,branch_name text,
  public_address text,neighborhood text,city text,state text,service_id uuid,service_name text,
  service_description text,category text,duration_minutes integer,price numeric,
  professional_id uuid,professional_name text,specialty text
)
language sql stable security invoker set search_path = ''
as $function$
  select * from private.get_public_salon_catalog(p_slug,p_branch_id);
$function$;

revoke all on function private.get_public_salon_catalog(text,uuid) from public;
grant execute on function private.get_public_salon_catalog(text,uuid) to anon,authenticated;
revoke all on function public.get_public_salon_catalog(text,uuid) from public;
grant execute on function public.get_public_salon_catalog(text,uuid) to anon,authenticated;

-- Disponibilidade: exige marca e unidade publicadas e aplica todos os conflitos do backend.
create or replace function private.get_customer_available_slots(
  p_org_id uuid,p_branch_id uuid,p_service_id uuid,p_date date,p_professional_id uuid,p_interval_minutes integer
)
returns table (starts_at timestamptz,professional_id uuid,professional_name text)
language plpgsql stable security definer set search_path = ''
as $function$
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

create or replace function public.get_customer_available_slots(
  p_org_id uuid,p_branch_id uuid,p_service_id uuid,p_date date,
  p_professional_id uuid default null,p_interval_minutes integer default 15
)
returns table (starts_at timestamptz,professional_id uuid,professional_name text)
language sql stable security invoker set search_path = ''
as $function$
  select * from private.get_customer_available_slots(
    p_org_id,p_branch_id,p_service_id,p_date,p_professional_id,p_interval_minutes
  );
$function$;

revoke all on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) from public;
grant execute on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to anon,authenticated;
revoke all on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) from public;
grant execute on function public.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to anon,authenticated;

commit;
