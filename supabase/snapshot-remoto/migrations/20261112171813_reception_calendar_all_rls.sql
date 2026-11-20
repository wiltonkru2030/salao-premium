
drop policy if exists appointments_select_scoped_app on public.appointments;
create policy appointments_select_scoped_app on public.appointments for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager'])
  or private.professional_app_scope(org_id) in ('calendar_all','all')
  or professional_id=private.current_professional_id(org_id)
);

drop policy if exists professionals_select_scoped_app on public.professionals;
create policy professionals_select_scoped_app on public.professionals for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager'])
  or private.professional_app_scope(org_id) in ('calendar_all','all')
  or profile_id=(select auth.uid())
);

drop policy if exists customers_select_scoped_app on public.customers;
create policy customers_select_scoped_app on public.customers for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager'])
  or private.professional_app_scope(org_id) in ('calendar_all','all')
  or exists(select 1 from public.appointments a where a.org_id=customers.org_id
      and a.customer_id=customers.id and a.professional_id=private.current_professional_id(customers.org_id))
  or exists(select 1 from public.service_orders o where o.org_id=customers.org_id and o.customer_id=customers.id
      and (o.assigned_professional_id=private.current_professional_id(customers.org_id)
        or exists(select 1 from public.service_order_items i where i.org_id=o.org_id
          and i.order_id=o.id and i.professional_id=private.current_professional_id(customers.org_id))))
);

drop policy if exists services_select_professional_app on public.services;
create policy services_select_professional_app on public.services for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager'])
  or private.professional_app_scope(org_id) in ('self','calendar_all','all')
);

drop policy if exists appointment_blocks_select_scoped_app on public.appointment_blocks;
create policy appointment_blocks_select_scoped_app on public.appointment_blocks for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager'])
  or private.professional_app_scope(org_id) in ('calendar_all','all')
  or professional_id=private.current_professional_id(org_id)
);

drop policy if exists service_orders_select_scoped_app on public.service_orders;
create policy service_orders_select_scoped_app on public.service_orders for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager'])
  or private.professional_app_scope(org_id) in ('calendar_all','all')
  or assigned_professional_id=private.current_professional_id(org_id)
  or exists(select 1 from public.service_order_items i where i.org_id=service_orders.org_id
    and i.order_id=service_orders.id and i.professional_id=private.current_professional_id(service_orders.org_id))
);

drop policy if exists service_order_items_select_scoped_app on public.service_order_items;
create policy service_order_items_select_scoped_app on public.service_order_items for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
  or private.professional_app_scope(org_id) in ('calendar_all','all')
  or professional_id=private.current_professional_id(org_id)
  or exists(select 1 from public.service_orders o where o.org_id=service_order_items.org_id
    and o.id=service_order_items.order_id
    and o.assigned_professional_id=private.current_professional_id(service_order_items.org_id))
);
