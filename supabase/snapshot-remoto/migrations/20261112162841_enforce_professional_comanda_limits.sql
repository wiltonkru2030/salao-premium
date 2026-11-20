
create index if not exists service_orders_created_by_idx on public.service_orders(created_by);
create index if not exists service_orders_org_branch_idx on public.service_orders(org_id,branch_id);
create index if not exists service_orders_org_customer_idx on public.service_orders(org_id,customer_id);
create index if not exists service_orders_org_appointment_idx on public.service_orders(org_id,appointment_id);
create index if not exists service_order_items_created_by_idx on public.service_order_items(created_by);
create index if not exists service_order_items_org_service_idx on public.service_order_items(org_id,service_id);
create index if not exists service_order_items_org_product_idx on public.service_order_items(org_id,product_id);

create or replace function private.enforce_professional_service_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare service_name text; service_price numeric;
begin
  if private.has_org_role(new.org_id, array['professional']) then
    if new.item_type <> 'service' or new.service_id is null then
      raise exception 'Profissionais só podem registrar serviços realizados.';
    end if;
    if new.professional_id <> private.current_professional_id(new.org_id) then
      raise exception 'O serviço deve ser vinculado ao profissional autenticado.';
    end if;
    select s.name,s.price into service_name,service_price
      from public.services s
     where s.org_id=new.org_id and s.id=new.service_id and s.active=true;
    if service_name is null then
      raise exception 'Serviço não encontrado ou inativo.';
    end if;
    new.description := service_name;
    new.quantity := 1;
    new.unit_price := service_price;
    new.discount := 0;
    new.total := service_price;
    new.created_by := (select auth.uid());
    new.performed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists service_order_items_enforce_professional on public.service_order_items;
create trigger service_order_items_enforce_professional
before insert or update on public.service_order_items
for each row execute function private.enforce_professional_service_order_item();
