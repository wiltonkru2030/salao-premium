-- SALÃO PREMIUM — catálogo de serviços por filial com serviços globais compartilhados.
-- branch_id NULL mantém um serviço disponível em todas as unidades.
-- Profissionais só consultam serviços compatíveis com sua unidade e permissão individual.

begin;

alter table public.services
  add column if not exists branch_id uuid;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.services'::regclass
      and conname='services_org_id_branch_id_fkey'
  ) then
    alter table public.services
      add constraint services_org_id_branch_id_fkey
      foreign key(org_id,branch_id) references public.branches(org_id,id);
  end if;
end;
$block$;

create index if not exists services_org_branch_active_name_idx
  on public.services(org_id,branch_id,active,name);

drop policy if exists services_select_professional_app on public.services;
create policy services_select_professional_app on public.services
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.professional_app_scope(org_id)='self'
      and exists (
        select 1 from public.professional_services ps
        where ps.org_id=services.org_id
          and ps.service_id=services.id
          and ps.professional_id=private.current_professional_id(services.org_id)
      )
    )
    or (
      private.professional_app_scope(org_id) in ('calendar_all','all')
      and exists (
        select 1 from public.professionals p
        where p.org_id=services.org_id
          and p.id=private.current_professional_id(services.org_id)
          and (services.branch_id is null or services.branch_id=p.branch_id)
      )
    )
  );

comment on column public.services.branch_id is
  'Filial proprietária do serviço; NULL representa serviço global compartilhado entre unidades.';

commit;
