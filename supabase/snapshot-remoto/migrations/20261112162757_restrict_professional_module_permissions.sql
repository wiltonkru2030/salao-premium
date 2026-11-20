
drop policy if exists appointment_blocks_select_member on public.appointment_blocks;
create policy appointment_blocks_select_staff_or_own
on public.appointment_blocks for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer'])
  or professional_id=private.current_professional_id(org_id)
);

drop policy if exists appointment_blocks_insert_staff on public.appointment_blocks;
create policy appointment_blocks_insert_staff
on public.appointment_blocks for insert to authenticated
with check (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist'])
  or (
    private.has_org_role(org_id, array['professional'])
    and professional_id=private.current_professional_id(org_id)
    and created_by=(select auth.uid())
  )
);

drop policy if exists appointment_blocks_update_staff on public.appointment_blocks;
create policy appointment_blocks_update_admin
on public.appointment_blocks for update to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager']))
with check (private.has_org_role(org_id, array['owner','admin','manager']));

drop policy if exists branches_select_member on public.branches;
create policy branches_select_staff
on public.branches for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists cash_movements_select_member on public.cash_movements;
create policy cash_movements_select_finance_staff
on public.cash_movements for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists cash_registers_select_member on public.cash_registers;
create policy cash_registers_select_finance_staff
on public.cash_registers for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists commission_rules_select_member on public.commission_rules;
create policy commission_rules_select_admin_finance
on public.commission_rules for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','finance']));

drop policy if exists expenses_select_member on public.expenses;
create policy expenses_select_finance
on public.expenses for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','finance']));

drop policy if exists inventory_movements_select_member on public.inventory_movements;
create policy inventory_movements_select_stock_staff
on public.inventory_movements for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists products_select_member on public.products;
create policy products_select_stock_staff
on public.products for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists sales_select_member on public.sales;
create policy sales_select_finance_staff
on public.sales for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists sale_items_select_member on public.sale_items;
create policy sale_items_select_finance_staff
on public.sale_items for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));

drop policy if exists app_settings_select_member on public.app_settings;
create policy app_settings_select_admin_staff
on public.app_settings for select to authenticated
using (private.has_org_role(org_id, array['owner','admin','manager','receptionist','finance','viewer']));
