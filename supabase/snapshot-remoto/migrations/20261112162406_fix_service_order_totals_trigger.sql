
create or replace function private.recalculate_service_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_org uuid; target_order uuid; item_total numeric;
begin
  if tg_op = 'DELETE' then
    target_org := old.org_id;
    target_order := old.order_id;
  else
    target_org := new.org_id;
    target_order := new.order_id;
  end if;

  select coalesce(sum(i.total),0) into item_total
  from public.service_order_items i
  where i.org_id=target_org and i.order_id=target_order;

  update public.service_orders o
     set subtotal=item_total,
         total=greatest(item_total-o.discount,0),
         updated_at=now()
   where o.org_id=target_org and o.id=target_order;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
