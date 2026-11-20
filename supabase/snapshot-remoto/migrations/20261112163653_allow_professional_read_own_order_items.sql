
drop policy if exists service_order_items_select_admin_or_own_professional on public.service_order_items;
create policy service_order_items_select_admin_or_own_order
on public.service_order_items for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer'])
  or exists (
    select 1 from public.service_orders o
    where o.org_id=service_order_items.org_id
      and o.id=service_order_items.order_id
      and o.assigned_professional_id=private.current_professional_id(service_order_items.org_id)
  )
);
