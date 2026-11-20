-- RASCUNHO — diretório público opt-in do SALÃO PREMIUM.
-- Não aplicar em produção sem revisão e autorização explícita.
-- Nenhuma tabela operacional recebe SELECT público; somente RPCs retornam campos autorizados.

begin;

create table if not exists public.salon_public_profiles (
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
  constraint salon_public_profiles_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint salon_public_profiles_display_name check (length(btrim(display_name)) between 2 and 120)
);

create table if not exists public.branch_public_profiles (
  org_id uuid not null,
  branch_id uuid not null,
  is_published boolean not null default false,
  public_address text,
  neighborhood text,
  city text not null,
  state char(2) not null,
  postal_code text,
  latitude double precision,
  longitude double precision,
  public_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, branch_id),
  constraint branch_public_profiles_branch_fk
    foreign key (org_id, branch_id) references public.branches(org_id, id) on delete cascade,
  constraint branch_public_profiles_city check (length(btrim(city)) between 2 and 100),
  constraint branch_public_profiles_state check (state ~ '^[A-Z]{2}$'),
  constraint branch_public_profiles_latitude check (latitude is null or latitude between -90 and 90),
  constraint branch_public_profiles_longitude check (longitude is null or longitude between -180 and 180),
  constraint branch_public_profiles_coordinates_pair check ((latitude is null) = (longitude is null))
);

create index if not exists branch_public_profiles_city_idx
  on public.branch_public_profiles (lower(city), state)
  where is_published;

alter table public.salon_public_profiles enable row level security;
alter table public.branch_public_profiles enable row level security;

drop policy if exists salon_public_profiles_select_admin on public.salon_public_profiles;
create policy salon_public_profiles_select_admin on public.salon_public_profiles
  for select to authenticated using (private.is_org_admin(org_id));
drop policy if exists salon_public_profiles_insert_admin on public.salon_public_profiles;
create policy salon_public_profiles_insert_admin on public.salon_public_profiles
  for insert to authenticated with check (private.is_org_admin(org_id));
drop policy if exists salon_public_profiles_update_admin on public.salon_public_profiles;
create policy salon_public_profiles_update_admin on public.salon_public_profiles
  for update to authenticated using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
drop policy if exists salon_public_profiles_delete_admin on public.salon_public_profiles;
create policy salon_public_profiles_delete_admin on public.salon_public_profiles
  for delete to authenticated using (private.is_org_admin(org_id));

drop policy if exists branch_public_profiles_select_admin on public.branch_public_profiles;
create policy branch_public_profiles_select_admin on public.branch_public_profiles
  for select to authenticated using (private.is_org_admin(org_id));
drop policy if exists branch_public_profiles_insert_admin on public.branch_public_profiles;
create policy branch_public_profiles_insert_admin on public.branch_public_profiles
  for insert to authenticated with check (private.is_org_admin(org_id));
drop policy if exists branch_public_profiles_update_admin on public.branch_public_profiles;
create policy branch_public_profiles_update_admin on public.branch_public_profiles
  for update to authenticated using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
drop policy if exists branch_public_profiles_delete_admin on public.branch_public_profiles;
create policy branch_public_profiles_delete_admin on public.branch_public_profiles
  for delete to authenticated using (private.is_org_admin(org_id));

revoke all on public.salon_public_profiles, public.branch_public_profiles from anon, public;
grant select, insert, update, delete on public.salon_public_profiles, public.branch_public_profiles to authenticated;

create or replace function private.search_public_salons(
  p_query text default null,
  p_city text default null,
  p_state text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_radius_km numeric default 30,
  p_limit integer default 30
)
returns table (
  org_id uuid,
  slug text,
  display_name text,
  description text,
  logo_url text,
  branch_id uuid,
  branch_name text,
  neighborhood text,
  city text,
  state char(2),
  public_phone text,
  distance_km numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Informe latitude e longitude juntas.' using errcode = '22023';
  end if;
  if p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then
    raise exception 'Localização inválida.' using errcode = '22023';
  end if;
  if p_radius_km is null or p_radius_km <= 0 or p_radius_km > 200 then
    raise exception 'Raio de busca inválido.' using errcode = '22023';
  end if;

  return query
  with published as (
    select
      sp.org_id, sp.slug, sp.display_name, sp.description, sp.logo_url,
      bp.branch_id, b.name as branch_name, bp.neighborhood, bp.city, bp.state,
      coalesce(bp.public_phone, sp.public_phone) as phone,
      case when p_latitude is not null and bp.latitude is not null then
        (6371 * 2 * asin(sqrt(least(1,
          power(sin(radians(bp.latitude - p_latitude) / 2), 2) +
          cos(radians(p_latitude)) * cos(radians(bp.latitude)) *
          power(sin(radians(bp.longitude - p_longitude) / 2), 2)
        ))))::numeric
      else null end as distance
    from public.salon_public_profiles sp
    join public.branch_public_profiles bp on bp.org_id = sp.org_id and bp.is_published
    join public.branches b on b.org_id = bp.org_id and b.id = bp.branch_id and b.active
    where sp.is_published
      and (nullif(btrim(p_query), '') is null or
        sp.display_name ilike '%' || btrim(p_query) || '%' or
        b.name ilike '%' || btrim(p_query) || '%')
      and (nullif(btrim(p_city), '') is null or bp.city ilike '%' || btrim(p_city) || '%')
      and (nullif(btrim(p_state), '') is null or bp.state = upper(btrim(p_state)))
  )
  select
    p.org_id, p.slug, p.display_name, p.description, p.logo_url,
    p.branch_id, p.branch_name, p.neighborhood, p.city, p.state, p.phone, p.distance
  from published p
  where (p_latitude is null or (p.distance is not null and p.distance <= p_radius_km))
  order by p.distance nulls last, p.display_name, p.branch_name
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$function$;

revoke all on function private.search_public_salons(text,text,text,double precision,double precision,numeric,integer) from public;
grant execute on function private.search_public_salons(text,text,text,double precision,double precision,numeric,integer) to anon, authenticated;

create or replace function public.search_public_salons(
  p_query text default null,
  p_city text default null,
  p_state text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_radius_km numeric default 30,
  p_limit integer default 30
)
returns table (
  org_id uuid, slug text, display_name text, description text, logo_url text,
  branch_id uuid, branch_name text, neighborhood text, city text, state char(2),
  public_phone text, distance_km numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.search_public_salons(
    p_query,p_city,p_state,p_latitude,p_longitude,p_radius_km,p_limit
  );
$function$;

revoke all on function public.search_public_salons(text,text,text,double precision,double precision,numeric,integer) from public;
grant execute on function public.search_public_salons(text,text,text,double precision,double precision,numeric,integer) to anon, authenticated;

create or replace function private.get_public_salon_catalog(
  p_slug text,
  p_branch_id uuid default null
)
returns table (
  org_id uuid,
  slug text,
  display_name text,
  description text,
  logo_url text,
  branch_id uuid,
  branch_name text,
  public_address text,
  neighborhood text,
  city text,
  state char(2),
  public_phone text,
  service_id uuid,
  service_name text,
  category text,
  service_description text,
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
    sp.org_id, sp.slug, sp.display_name, sp.description, sp.logo_url,
    bp.branch_id, b.name, bp.public_address, bp.neighborhood, bp.city, bp.state,
    coalesce(bp.public_phone, sp.public_phone),
    s.id, s.name, s.category, s.description, s.duration_minutes, s.price,
    pro.id, pro.name, pro.specialty
  from public.salon_public_profiles sp
  join public.branch_public_profiles bp on bp.org_id = sp.org_id and bp.is_published
  join public.branches b on b.org_id = bp.org_id and b.id = bp.branch_id and b.active
  join public.services s on s.org_id = sp.org_id and s.active
  left join public.professional_services ps on ps.org_id = s.org_id and ps.service_id = s.id
  left join public.professionals pro
    on pro.org_id = ps.org_id and pro.id = ps.professional_id
   and pro.active and (pro.branch_id is null or pro.branch_id = bp.branch_id)
  where sp.is_published and sp.slug = lower(btrim(p_slug))
    and (p_branch_id is null or bp.branch_id = p_branch_id)
  order by b.name, s.category, s.name, pro.name;
$function$;

revoke all on function private.get_public_salon_catalog(text,uuid) from public;
grant execute on function private.get_public_salon_catalog(text,uuid) to anon, authenticated;

create or replace function public.get_public_salon_catalog(
  p_slug text,
  p_branch_id uuid default null
)
returns table (
  org_id uuid, slug text, display_name text, description text, logo_url text,
  branch_id uuid, branch_name text, public_address text, neighborhood text, city text,
  state char(2), public_phone text, service_id uuid, service_name text, category text,
  service_description text, duration_minutes integer, price numeric,
  professional_id uuid, professional_name text, specialty text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_public_salon_catalog(p_slug,p_branch_id);
$function$;

revoke all on function public.get_public_salon_catalog(text,uuid) from public;
grant execute on function public.get_public_salon_catalog(text,uuid) to anon, authenticated;

grant usage on schema private to anon, authenticated;

comment on table public.salon_public_profiles is
  'Perfil público opcional da organização; somente os campos publicados são expostos por RPC.';
comment on table public.branch_public_profiles is
  'Dados de localização autorizados publicamente para cada filial publicada.';
comment on function public.search_public_salons(text,text,text,double precision,double precision,numeric,integer) is
  'Pesquisa somente salões e unidades que optaram por publicação; nunca consulta dados privados diretamente.';
comment on function public.get_public_salon_catalog(text,uuid) is
  'Retorna catálogo e profissionais ativos apenas para organização e filial publicadas.';

commit;
