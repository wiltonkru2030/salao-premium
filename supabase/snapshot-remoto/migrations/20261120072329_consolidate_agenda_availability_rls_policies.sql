-- Consolida políticas RLS de leitura e separa permissões de escrita.
-- Objetivo: remover avaliações duplicadas sem ampliar o acesso entre organizações.
-- As funções de escopo continuam sendo a fonte de autorização por papel/tenant.

begin;

-- Agenda: recepção lê a agenda da organização; gestão lê tudo no escopo;
-- profissional continua limitado ao próprio calendário, salvo escopo amplo explícito.
drop policy if exists appointment_blocks_select_receptionist on public.appointment_blocks;
drop policy if exists appointment_blocks_select_scoped_app on public.appointment_blocks;
create policy appointment_blocks_select_scoped
on public.appointment_blocks
for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id) = any (array['calendar_all','all']::text[])
  or professional_id = private.current_professional_id(org_id)
  or professional_id = private.professional_app_profile_id(org_id)
);

drop policy if exists appointments_select_receptionist on public.appointments;
drop policy if exists appointments_select_scoped_app on public.appointments;
create policy appointments_select_scoped
on public.appointments
for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id) = any (array['calendar_all','all']::text[])
  or professional_id = private.current_professional_id(org_id)
  or professional_id = private.professional_app_profile_id(org_id)
);

-- Expediente e afastamentos: leitura para membros; escrita somente owner/admin.
drop policy if exists branch_hours_admin_write on public.branch_business_hours;
drop policy if exists branch_hours_member_read on public.branch_business_hours;
create policy branch_hours_member_read
on public.branch_business_hours for select to authenticated
using (private.is_org_member(org_id));
create policy branch_hours_admin_insert
on public.branch_business_hours for insert to authenticated
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy branch_hours_admin_update
on public.branch_business_hours for update to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]))
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy branch_hours_admin_delete
on public.branch_business_hours for delete to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]));

drop policy if exists branch_closures_admin_write on public.branch_closures;
drop policy if exists branch_closures_member_read on public.branch_closures;
create policy branch_closures_member_read
on public.branch_closures for select to authenticated
using (private.is_org_member(org_id));
create policy branch_closures_admin_insert
on public.branch_closures for insert to authenticated
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy branch_closures_admin_update
on public.branch_closures for update to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]))
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy branch_closures_admin_delete
on public.branch_closures for delete to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]));

drop policy if exists professional_time_off_admin_write on public.professional_time_off;
drop policy if exists professional_time_off_member_read on public.professional_time_off;
create policy professional_time_off_member_read
on public.professional_time_off for select to authenticated
using (private.is_org_member(org_id));
create policy professional_time_off_admin_insert
on public.professional_time_off for insert to authenticated
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy professional_time_off_admin_update
on public.professional_time_off for update to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]))
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy professional_time_off_admin_delete
on public.professional_time_off for delete to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]));

drop policy if exists professional_hours_admin_write on public.professional_working_hours;
drop policy if exists professional_hours_member_read on public.professional_working_hours;
create policy professional_hours_member_read
on public.professional_working_hours for select to authenticated
using (private.is_org_member(org_id));
create policy professional_hours_admin_insert
on public.professional_working_hours for insert to authenticated
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy professional_hours_admin_update
on public.professional_working_hours for update to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]))
with check (private.has_org_role(org_id, array['owner','admin']::text[]));
create policy professional_hours_admin_delete
on public.professional_working_hours for delete to authenticated
using (private.has_org_role(org_id, array['owner','admin']::text[]));

commit;
