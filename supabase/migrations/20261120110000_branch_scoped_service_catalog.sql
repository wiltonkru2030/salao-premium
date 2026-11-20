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

-- Profissional autenticado só pode resolver o nome da unidade à qual está vinculado.
drop policy if exists branches_select_staff on public.branches;
create policy branches_select_staff on public.branches
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance','viewer'])
    or exists (
      select 1 from public.professionals p
      where p.org_id=branches.org_id
        and p.id=private.current_professional_id(branches.org_id)
        and p.branch_id=branches.id
    )
  );

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
          and exists (
            select 1 from public.professionals p
            where p.org_id=services.org_id
              and p.id=ps.professional_id
              and (services.branch_id is null or services.branch_id=p.branch_id)
          )
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

-- Profissional com acesso total só visualiza produtos da própria unidade e produtos globais.
drop policy if exists products_select_admin_or_full_app on public.products;
create policy products_select_admin_or_full_app on public.products
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.professional_app_scope(org_id)='all'
      and exists (
        select 1 from public.professionals p
        where p.org_id=products.org_id
          and p.id=private.current_professional_id(products.org_id)
          and (products.branch_id is null or products.branch_id=p.branch_id)
      )
    )
  );


-- Agenda: calendários completos de profissionais ficam restritos à unidade vinculada.
drop policy if exists appointments_select_scoped on public.appointments;
create policy appointments_select_scoped on public.appointments
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.professional_app_scope(org_id) in ('calendar_all','all')
      and exists (
        select 1 from public.professionals p
        where p.org_id=appointments.org_id
          and p.id=private.current_professional_id(appointments.org_id)
          and (appointments.branch_id is null or appointments.branch_id=p.branch_id)
      )
    )
    or (
      (professional_id=private.current_professional_id(org_id)
       or professional_id=private.professional_app_profile_id(org_id))
      and exists (
        select 1 from public.professionals p
        where p.org_id=appointments.org_id and p.id=appointments.professional_id
          and (appointments.branch_id is null or appointments.branch_id=p.branch_id)
      )
    )
  );

drop policy if exists appointments_insert_staff on public.appointments;
create policy appointments_insert_staff on public.appointments
  for insert to authenticated
  with check (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.has_org_role(org_id,array['professional'])
      and professional_id=private.current_professional_id(org_id)
      and booking_source='professional'
      and created_by=(select auth.uid())
      and exists (
        select 1 from public.professionals p
        where p.org_id=appointments.org_id and p.id=appointments.professional_id
          and appointments.branch_id is not distinct from p.branch_id
      )
    )
  );

drop policy if exists appointment_blocks_select_scoped on public.appointment_blocks;
create policy appointment_blocks_select_scoped on public.appointment_blocks
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.professional_app_scope(org_id) in ('calendar_all','all')
      and exists (
        select 1 from public.professionals p
        where p.org_id=appointment_blocks.org_id
          and p.id=private.current_professional_id(appointment_blocks.org_id)
          and (appointment_blocks.branch_id is null or appointment_blocks.branch_id=p.branch_id)
      )
    )
    or (
      (professional_id=private.current_professional_id(org_id)
       or professional_id=private.professional_app_profile_id(org_id))
      and exists (
        select 1 from public.professionals p
        where p.org_id=appointment_blocks.org_id and p.id=appointment_blocks.professional_id
          and (appointment_blocks.branch_id is null or appointment_blocks.branch_id=p.branch_id)
      )
    )
  );

drop policy if exists appointment_blocks_insert_staff on public.appointment_blocks;
create policy appointment_blocks_insert_staff on public.appointment_blocks
  for insert to authenticated
  with check (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.has_org_role(org_id,array['professional'])
      and professional_id=private.current_professional_id(org_id)
      and created_by=(select auth.uid())
      and exists (
        select 1 from public.professionals p
        where p.org_id=appointment_blocks.org_id and p.id=appointment_blocks.professional_id
          and appointment_blocks.branch_id is not distinct from p.branch_id
      )
    )
  );

-- Acesso amplo de Agenda no App Profissional não revela profissionais de outras unidades.
drop policy if exists professionals_select_scoped_app on public.professionals;
create policy professionals_select_scoped_app on public.professionals
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or (
      private.professional_app_scope(org_id) in ('calendar_all','all')
      and exists (
        select 1 from public.professionals own
        where own.org_id=professionals.org_id
          and own.id=private.current_professional_id(professionals.org_id)
          and professionals.branch_id is not distinct from own.branch_id
      )
    )
    or profile_id=(select auth.uid())
  );

-- Os vínculos do profissional respeitam serviços da própria unidade ou globais.
drop policy if exists professional_services_select_scoped on public.professional_services;
create policy professional_services_select_scoped on public.professional_services
  for select to authenticated
  using (
    private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
    or professional_id=private.current_professional_id(org_id)
    or (
      private.professional_app_scope(org_id) in ('calendar_all','all')
      and exists (
        select 1 from public.professionals p
        join public.services s on s.org_id=professional_services.org_id
          and s.id=professional_services.service_id
        where p.org_id=professional_services.org_id
          and p.id=private.current_professional_id(professional_services.org_id)
          and (s.branch_id is null or s.branch_id=p.branch_id)
      )
    )
  );

commit;
