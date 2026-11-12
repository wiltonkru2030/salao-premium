create or replace function private.professional_app_scope(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when m.role='professional' and exists (
      select 1 from public.professionals p
      where p.org_id=m.org_id and p.profile_id=m.user_id
        and p.active=true and p.access_enabled=true
    ) then 'self'
    when m.professional_app_enabled=true
      and m.professional_app_scope = any(array['self','calendar_all','all']::text[])
      then m.professional_app_scope
    else 'none'
  end
  from public.org_memberships m
  where m.org_id=target_org and m.user_id=(select auth.uid()) and m.status='active'
  limit 1;
$function$;

create or replace function private.professional_app_profile_id(target_org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id
  from public.professionals p
  join public.org_memberships m
    on m.org_id=p.org_id and m.user_id=(select auth.uid()) and m.status='active'
  where p.org_id=target_org and p.profile_id=(select auth.uid()) and p.active=true
    and (
      (m.role='professional' and p.access_enabled=true)
      or (m.role<>'professional' and m.professional_app_enabled=true and m.professional_app_scope='self')
    )
  limit 1;
$function$;

revoke all on function private.professional_app_profile_id(uuid) from public, anon;
grant execute on function private.professional_app_profile_id(uuid) to authenticated, service_role;
revoke all on function private.professional_app_scope(uuid) from public, anon;
grant execute on function private.professional_app_scope(uuid) to authenticated, service_role;

drop policy if exists appointments_select_scoped_app on public.appointments;
create policy appointments_select_scoped_app on public.appointments for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or professional_id=private.current_professional_id(org_id)
  or professional_id=private.professional_app_profile_id(org_id)
);

drop policy if exists appointment_blocks_select_scoped_app on public.appointment_blocks;
create policy appointment_blocks_select_scoped_app on public.appointment_blocks for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or professional_id=private.current_professional_id(org_id)
  or professional_id=private.professional_app_profile_id(org_id)
);

drop policy if exists service_orders_select_scoped_app on public.service_orders;
create policy service_orders_select_scoped_app on public.service_orders for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or assigned_professional_id=private.current_professional_id(org_id)
  or assigned_professional_id=private.professional_app_profile_id(org_id)
  or exists (select 1 from public.service_order_items i where i.org_id=service_orders.org_id and i.order_id=service_orders.id
    and (i.professional_id=private.current_professional_id(service_orders.org_id)
      or i.professional_id=private.professional_app_profile_id(service_orders.org_id)))
);

drop policy if exists service_order_items_select_scoped_app on public.service_order_items;
create policy service_order_items_select_scoped_app on public.service_order_items for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or professional_id=private.current_professional_id(org_id)
  or professional_id=private.professional_app_profile_id(org_id)
  or exists (select 1 from public.service_orders o where o.org_id=service_order_items.org_id and o.id=service_order_items.order_id
    and (o.assigned_professional_id=private.current_professional_id(service_order_items.org_id)
      or o.assigned_professional_id=private.professional_app_profile_id(service_order_items.org_id)))
);

drop policy if exists commissions_select_scoped_app on public.commissions;
create policy commissions_select_scoped_app on public.commissions for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager','finance']::text[])
  or professional_id=private.current_professional_id(org_id)
  or professional_id=private.professional_app_profile_id(org_id)
);

drop policy if exists commission_payouts_select_scoped on public.commission_payouts;
create policy commission_payouts_select_scoped on public.commission_payouts for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager','finance']::text[])
  or professional_id=private.current_professional_id(org_id)
  or professional_id=private.professional_app_profile_id(org_id)
);

drop policy if exists commission_payout_items_select_scoped on public.commission_payout_items;
create policy commission_payout_items_select_scoped on public.commission_payout_items for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager','finance']::text[])
  or exists (select 1 from public.commissions c where c.org_id=commission_payout_items.org_id
    and c.id=commission_payout_items.commission_id
    and (c.professional_id=private.current_professional_id(commission_payout_items.org_id)
      or c.professional_id=private.professional_app_profile_id(commission_payout_items.org_id)))
);

drop policy if exists customers_select_scoped_app on public.customers;
create policy customers_select_scoped_app on public.customers for select to authenticated using (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or exists (select 1 from public.appointments a where a.org_id=customers.org_id and a.customer_id=customers.id
    and (a.professional_id=private.current_professional_id(customers.org_id)
      or a.professional_id=private.professional_app_profile_id(customers.org_id)))
  or exists (select 1 from public.service_orders o where o.org_id=customers.org_id and o.customer_id=customers.id
    and (o.assigned_professional_id=private.current_professional_id(customers.org_id)
      or o.assigned_professional_id=private.professional_app_profile_id(customers.org_id)
      or exists (select 1 from public.service_order_items i where i.org_id=o.org_id and i.order_id=o.id
        and (i.professional_id=private.current_professional_id(customers.org_id)
          or i.professional_id=private.professional_app_profile_id(customers.org_id)))))
);
