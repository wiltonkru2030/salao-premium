-- SALÃO PREMIUM — categorias do catálogo de serviços e produtos.
-- Migration versionada; aplicar em QA e validar migração dos valores textuais existentes.

begin;

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_type text not null check(category_type in ('service','product')),
  name text not null check(length(btrim(name)) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_categories_org_type_name_unique
  on public.catalog_categories(org_id,category_type,lower(btrim(name)));
create index if not exists catalog_categories_org_type_active_name_idx
  on public.catalog_categories(org_id,category_type,active,name);

alter table public.catalog_categories enable row level security;
revoke all on public.catalog_categories from public,anon;
grant select on public.catalog_categories to authenticated;

drop policy if exists catalog_categories_select_org_members on public.catalog_categories;
create policy catalog_categories_select_org_members on public.catalog_categories
  for select to authenticated
  using (private.has_org_role(org_id,array[
    'owner','admin','manager','professional','receptionist','finance','viewer'
  ]));

drop trigger if exists audit_row_change on public.catalog_categories;
create trigger audit_row_change after insert or update or delete on public.catalog_categories
  for each row execute function private.capture_row_audit();

-- Migra categorias textuais já usadas no catálogo para a tabela administrável.
insert into public.catalog_categories(org_id,category_type,name)
select org_id,'service',btrim(category)
from public.services
where category is not null and length(btrim(category)) between 2 and 80
group by org_id,btrim(category)
on conflict do nothing;

insert into public.catalog_categories(org_id,category_type,name)
select org_id,'product',btrim(category)
from public.products
where category is not null and length(btrim(category)) between 2 and 80
group by org_id,btrim(category)
on conflict do nothing;

create or replace function private.save_catalog_category(
  p_org_id uuid,
  p_category_id uuid,
  p_category_type text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text:=btrim(coalesce(p_name,''));
  v_old_name text;
  v_id uuid;
begin
  if auth.uid() is null or not private.is_org_admin(p_org_id) then
    raise exception 'Sem permissão para alterar categorias.' using errcode='42501';
  end if;
  if p_category_type is null or p_category_type not in ('service','product') or length(v_name) not between 2 and 80 then
    raise exception 'Tipo ou nome de categoria inválido.' using errcode='22023';
  end if;

  if p_category_id is null then
    insert into public.catalog_categories(org_id,category_type,name)
    values(p_org_id,p_category_type,v_name)
    returning id into v_id;
    v_old_name:=null;
  else
    select name into v_old_name
    from public.catalog_categories
    where id=p_category_id and org_id=p_org_id and category_type=p_category_type
    for update;
    if not found then
      raise exception 'Categoria não encontrada.' using errcode='P0002';
    end if;
    update public.catalog_categories
      set name=v_name,updated_at=now()
      where id=p_category_id and org_id=p_org_id
      returning id into v_id;
  end if;

  -- Mantém o texto legado dos itens sincronizado quando a categoria é renomeada.
  if v_old_name is not null and v_old_name is distinct from v_name then
    if p_category_type='service' then
      update public.services set category=v_name
       where org_id=p_org_id and category=v_old_name;
    else
      update public.products set category=v_name
       where org_id=p_org_id and category=v_old_name;
    end if;
  end if;
  return v_id;
end;
$function$;

revoke all on function private.save_catalog_category(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.save_catalog_category(uuid,uuid,text,text) to authenticated;

create or replace function public.save_catalog_category(
  p_org_id uuid,
  p_category_id uuid,
  p_category_type text,
  p_name text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.save_catalog_category(p_org_id,p_category_id,p_category_type,p_name);
$function$;

revoke all on function public.save_catalog_category(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_catalog_category(uuid,uuid,text,text) to authenticated;

create or replace function private.set_catalog_category_active(
  p_org_id uuid,
  p_category_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null or not private.is_org_admin(p_org_id) then
    raise exception 'Sem permissão para alterar categorias.' using errcode='42501';
  end if;
  if p_category_id is null or p_active is null then
    raise exception 'Categoria ou situação inválida.' using errcode='22023';
  end if;
  update public.catalog_categories
    set active=p_active,updated_at=now()
    where org_id=p_org_id and id=p_category_id;
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$function$;

revoke all on function private.set_catalog_category_active(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.set_catalog_category_active(uuid,uuid,boolean) to authenticated;

create or replace function public.set_catalog_category_active(
  p_org_id uuid,
  p_category_id uuid,
  p_active boolean
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.set_catalog_category_active(p_org_id,p_category_id,p_active);
$function$;

revoke all on function public.set_catalog_category_active(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_catalog_category_active(uuid,uuid,boolean) to authenticated;

commit;
