-- Candidata de catálogo reutilizável de combos, ainda sem integração de venda/reserva.
-- Não aplicar antes de definir como pausas liberam recursos e como preço/descontos são distribuídos.
begin;
create table public.service_packages(
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid,
 name text not null check(length(btrim(name)) between 2 and 120),
 description text check(length(description)<=1000),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_id,id),
 foreign key(org_id,branch_id) references public.branches(org_id,id)
);
create table public.service_package_items(
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 package_id uuid not null,
 service_id uuid not null,
 sort_order integer not null check(sort_order between 1 and 100),
 quantity integer not null default 1 check(quantity between 1 and 100),
 pause_after_minutes integer not null default 0 check(pause_after_minutes between 0 and 720),
 unique(org_id,package_id,sort_order),
 foreign key(org_id,package_id) references public.service_packages(org_id,id) on delete cascade,
 foreign key(org_id,service_id) references public.services(org_id,id)
);
create index service_packages_org_branch_idx on public.service_packages(org_id,branch_id);
create index service_package_items_service_idx on public.service_package_items(org_id,service_id);
alter table public.service_packages enable row level security;
alter table public.service_package_items enable row level security;
revoke all on public.service_packages,public.service_package_items from public,anon,authenticated;
grant select on public.service_packages,public.service_package_items to authenticated;
-- Escrita será concedida através de RPC transacional própria, não em tabelas diretamente.
create policy service_packages_staff_select on public.service_packages for select to authenticated
using(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));
create policy service_package_items_staff_select on public.service_package_items for select to authenticated
using(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));
comment on table public.service_packages is 'Definição reutilizável; não representa pacote vendido, saldo de sessões ou agendamento.';
comment on column public.service_package_items.pause_after_minutes is 'Intervalo planejado entre itens. Não libera automaticamente disponibilidade do profissional.';
commit;
