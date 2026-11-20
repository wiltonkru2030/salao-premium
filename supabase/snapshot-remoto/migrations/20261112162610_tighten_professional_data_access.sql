
drop policy if exists appointments_update_staff on public.appointments;
create policy appointments_update_admin_or_reception
on public.appointments for update to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist']))
with check (private.has_org_role(org_id, array['owner','admin','manager','receptionist']));

drop policy if exists appointments_insert_staff on public.appointments;
create policy appointments_insert_staff
on public.appointments for insert to authenticated
with check (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist'])
  or (
    private.has_org_role(org_id, array['professional'])
    and professional_id = private.current_professional_id(org_id)
    and booking_source = 'professional'
    and created_by = (select auth.uid())
  )
);

drop policy if exists professionals_select_member on public.professionals;
create policy professionals_select_admin_or_self
on public.professionals for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer'])
  or profile_id = (select auth.uid())
);

drop policy if exists customers_select_member on public.customers;
create policy customers_select_staff_or_own_appointments
on public.customers for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer'])
  or exists (
    select 1 from public.appointments a
    where a.org_id=customers.org_id and a.customer_id=customers.id
      and a.professional_id=private.current_professional_id(customers.org_id)
  )
  or exists (
    select 1 from public.service_orders o
    where o.org_id=customers.org_id and o.customer_id=customers.id
      and o.assigned_professional_id=private.current_professional_id(customers.org_id)
  )
);
