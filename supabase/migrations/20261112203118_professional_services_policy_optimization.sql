drop policy if exists professional_services_manage_admin on public.professional_services;
drop policy if exists professional_services_insert_admin on public.professional_services;
create policy professional_services_insert_admin
on public.professional_services for insert to authenticated
with check (private.is_org_admin(org_id));
drop policy if exists professional_services_delete_admin on public.professional_services;
create policy professional_services_delete_admin
on public.professional_services for delete to authenticated
using (private.is_org_admin(org_id));
