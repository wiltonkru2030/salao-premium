
create or replace function private.has_org_role(target_org uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
  select 1 from public.org_memberships m
  where m.org_id=target_org and m.user_id=(select auth.uid())
    and m.status='active' and m.role=any(allowed_roles)
 );
$$;
revoke all on function private.has_org_role(uuid,text[]) from public,anon;
grant execute on function private.has_org_role(uuid,text[]) to authenticated;

-- Restringe gravações por função, em vez de tratar qualquer usuário autenticado como administrador.
drop policy if exists customers_insert_admin on public.customers;
drop policy if exists customers_update_admin on public.customers;
drop policy if exists customers_delete_admin on public.customers;
create policy customers_insert_staff on public.customers for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));
create policy customers_update_staff on public.customers for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','receptionist'])) with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));
create policy customers_delete_admin on public.customers for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists appointments_insert_admin on public.appointments;
drop policy if exists appointments_update_admin on public.appointments;
drop policy if exists appointments_delete_admin on public.appointments;
create policy appointments_insert_staff on public.appointments for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','professional']));
create policy appointments_update_staff on public.appointments for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','receptionist','professional'])) with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','professional']));
create policy appointments_delete_admin on public.appointments for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists appointment_blocks_insert_admin on public.appointment_blocks;
drop policy if exists appointment_blocks_update_admin on public.appointment_blocks;
drop policy if exists appointment_blocks_delete_admin on public.appointment_blocks;
create policy appointment_blocks_insert_staff on public.appointment_blocks for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','professional']));
create policy appointment_blocks_update_staff on public.appointment_blocks for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','professional'])) with check(private.has_org_role(org_id,array['owner','admin','manager','professional']));
create policy appointment_blocks_delete_admin on public.appointment_blocks for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists sales_insert_admin on public.sales;
drop policy if exists sales_update_admin on public.sales;
drop policy if exists sales_delete_admin on public.sales;
create policy sales_insert_staff on public.sales for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy sales_update_staff on public.sales for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance'])) with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy sales_delete_admin on public.sales for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists sale_items_insert_admin on public.sale_items;
drop policy if exists sale_items_update_admin on public.sale_items;
drop policy if exists sale_items_delete_admin on public.sale_items;
create policy sale_items_insert_staff on public.sale_items for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy sale_items_update_staff on public.sale_items for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance'])) with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy sale_items_delete_admin on public.sale_items for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists cash_registers_insert_admin on public.cash_registers;
drop policy if exists cash_registers_update_admin on public.cash_registers;
drop policy if exists cash_registers_delete_admin on public.cash_registers;
create policy cash_registers_insert_staff on public.cash_registers for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy cash_registers_update_staff on public.cash_registers for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance'])) with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy cash_registers_delete_admin on public.cash_registers for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists cash_movements_insert_admin on public.cash_movements;
drop policy if exists cash_movements_update_admin on public.cash_movements;
drop policy if exists cash_movements_delete_admin on public.cash_movements;
create policy cash_movements_insert_staff on public.cash_movements for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy cash_movements_update_staff on public.cash_movements for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance'])) with check(private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance']));
create policy cash_movements_delete_admin on public.cash_movements for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists expenses_insert_admin on public.expenses;
drop policy if exists expenses_update_admin on public.expenses;
drop policy if exists expenses_delete_admin on public.expenses;
create policy expenses_insert_finance on public.expenses for insert to authenticated with check(private.has_org_role(org_id,array['owner','admin','manager','finance']));
create policy expenses_update_finance on public.expenses for update to authenticated using(private.has_org_role(org_id,array['owner','admin','manager','finance'])) with check(private.has_org_role(org_id,array['owner','admin','manager','finance']));
create policy expenses_delete_admin on public.expenses for delete to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

drop policy if exists notifications_select_member on public.notifications;
drop policy if exists notifications_update_admin on public.notifications;
drop policy if exists notifications_delete_admin on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using(private.is_org_member(org_id) and (user_id is null or user_id=(select auth.uid())));
create policy notifications_update_own on public.notifications for update to authenticated using(private.is_org_member(org_id) and user_id=(select auth.uid())) with check(private.is_org_member(org_id) and user_id=(select auth.uid()));
create policy notifications_delete_admin on public.notifications for delete to authenticated using(private.is_org_admin(org_id));

drop policy if exists audit_logs_select_member on public.audit_logs;
drop policy if exists audit_logs_insert_admin on public.audit_logs;
drop policy if exists audit_logs_update_admin on public.audit_logs;
drop policy if exists audit_logs_delete_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs for select to authenticated using(private.has_org_role(org_id,array['owner','admin','manager']));

create index if not exists org_memberships_user_status_idx on public.org_memberships(user_id,status);
create index if not exists branches_org_id_idx on public.branches(org_id);
create index if not exists customers_org_id_idx on public.customers(org_id);
create index if not exists professionals_org_id_idx on public.professionals(org_id);
create index if not exists services_org_id_idx on public.services(org_id);
create index if not exists products_org_id_idx on public.products(org_id);
create index if not exists appointments_org_id_professional_id_idx on public.appointments(org_id,professional_id);
create index if not exists appointment_blocks_org_id_idx on public.appointment_blocks(org_id);
create index if not exists sales_org_id_created_at_idx on public.sales(org_id,created_at desc);
create index if not exists expenses_org_id_due_date_idx on public.expenses(org_id,due_date);
create index if not exists notifications_org_user_created_idx on public.notifications(org_id,user_id,created_at desc);
