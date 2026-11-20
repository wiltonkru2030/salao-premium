
create or replace function private.recalculate_service_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_org uuid; target_order uuid;
begin
  target_org := coalesce(new.org_id, old.org_id);
  target_order := coalesce(new.order_id, old.order_id);
  update public.service_orders o
     set subtotal = coalesce((
           select sum(i.total) from public.service_order_items i
           where i.org_id=target_org and i.order_id=target_order
         ),0),
         total = greatest(coalesce((
           select sum(i.total) from public.service_order_items i
           where i.org_id=target_org and i.order_id=target_order
         ),0) - o.discount,0),
         updated_at = now()
   where o.org_id=target_org and o.id=target_order;
  return coalesce(new,old);
end;
$$;
drop trigger if exists service_order_items_recalculate_totals on public.service_order_items;
create trigger service_order_items_recalculate_totals
after insert or update or delete on public.service_order_items
for each row execute function private.recalculate_service_order_totals();
