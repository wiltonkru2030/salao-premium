
create or replace function private.professional_has_service_order_item(target_org uuid,target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.service_order_items i
    where i.org_id=target_org and i.order_id=target_order
      and (i.professional_id=private.current_professional_id(target_org)
        or i.professional_id=private.professional_app_profile_id(target_org))
  );
$function$;

create or replace function private.professional_is_assigned_to_order(target_org uuid,target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.service_orders o
    where o.org_id=target_org and o.id=target_order
      and (o.assigned_professional_id=private.current_professional_id(target_org)
        or o.assigned_professional_id=private.professional_app_profile_id(target_org))
  );
$function$;

revoke all on function private.professional_has_service_order_item(uuid,uuid) from public, anon;
grant execute on function private.professional_has_service_order_item(uuid,uuid) to authenticated, service_role;
revoke all on function private.professional_is_assigned_to_order(uuid,uuid) from public, anon;
grant execute on function private.professional_is_assigned_to_order(uuid,uuid) to authenticated, service_role;

drop policy if exists service_orders_select_scoped_app on public.service_orders;
create policy service_orders_select_scoped_app on public.service_orders
for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or assigned_professional_id=private.current_professional_id(org_id)
  or assigned_professional_id=private.professional_app_profile_id(org_id)
  or private.professional_has_service_order_item(org_id,id)
);

drop policy if exists service_order_items_select_scoped_app on public.service_order_items;
create policy service_order_items_select_scoped_app on public.service_order_items
for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist']::text[])
  or private.professional_app_scope(org_id)=any(array['calendar_all','all']::text[])
  or professional_id=private.current_professional_id(org_id)
  or professional_id=private.professional_app_profile_id(org_id)
  or private.professional_is_assigned_to_order(org_id,order_id)
);
