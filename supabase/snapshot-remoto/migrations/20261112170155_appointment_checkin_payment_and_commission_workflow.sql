
drop policy if exists service_order_items_insert_scoped_app on public.service_order_items;
create policy service_order_items_insert_scoped_app
on public.service_order_items for insert to authenticated
with check (
  private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
  or private.professional_app_scope(org_id)='all'
  or (
    item_type='service'
    and professional_id=private.current_professional_id(org_id)
    and exists (
      select 1 from public.service_orders o
      where o.org_id=service_order_items.org_id and o.id=service_order_items.order_id
        and o.status in ('open','in_progress','partially_paid')
        and (
          o.assigned_professional_id=service_order_items.professional_id
          or exists (
            select 1 from public.appointments a
            where a.org_id=o.org_id and a.service_order_id=o.id
              and a.professional_id=service_order_items.professional_id
          )
        )
    )
  )
);

create or replace function private.prevent_appointment_overlap()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.starts_at is null or new.ends_at is null or new.ends_at<=new.starts_at then
    raise exception 'O horário final deve ser posterior ao horário inicial.';
  end if;
  if new.professional_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text||':'||new.professional_id::text,0));
  if new.status not in ('cancelled','no_show') and exists(
    select 1 from public.appointments a
    where a.org_id=new.org_id and a.professional_id=new.professional_id
      and a.id is distinct from new.id and a.status not in ('cancelled','no_show')
      and new.starts_at<a.ends_at and new.ends_at>a.starts_at
  ) then raise exception 'Já existe um agendamento deste profissional nesse horário.'; end if;
  if new.status not in ('cancelled','no_show') and exists(
    select 1 from public.appointment_blocks b
    where b.org_id=new.org_id and (b.professional_id is null or b.professional_id=new.professional_id)
      and new.starts_at<b.ends_at and new.ends_at>b.starts_at
  ) then raise exception 'Este horário está bloqueado para o profissional.'; end if;
  return new;
end;
$$;
drop trigger if exists appointments_prevent_overlap on public.appointments;
create trigger appointments_prevent_overlap
before insert or update of org_id,professional_id,starts_at,ends_at,status
on public.appointments for each row execute function private.prevent_appointment_overlap();

create or replace function private.sync_appointment_comanda_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='cancelled' and old.status is distinct from new.status then
    new.cancelled_at:=coalesce(new.cancelled_at,now());
    if pg_trigger_depth()=1 and new.service_order_id is not null and not exists(
      select 1 from public.appointments other
      where other.org_id=new.org_id and other.service_order_id=new.service_order_id
        and other.id<>new.id and other.status not in ('cancelled','completed')
    ) then
      update public.service_orders set status='cancelled',updated_at=now()
       where id=new.service_order_id and org_id=new.org_id and status not in ('cancelled','closed');
    end if;
  elsif new.status='completed' and old.status is distinct from new.status then
    new.completed_at:=coalesce(new.completed_at,now());
  end if;
  return new;
end;
$$;
create or replace function private.sync_comanda_appointment_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='cancelled' and old.status is distinct from new.status and pg_trigger_depth()=1 then
    update public.appointments set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
     where org_id=new.org_id and service_order_id=new.id and status not in ('cancelled','completed');
  end if;
  return new;
end;
$$;
drop trigger if exists appointments_sync_comanda_status on public.appointments;
create trigger appointments_sync_comanda_status before update of status on public.appointments
for each row execute function private.sync_appointment_comanda_status();
drop trigger if exists service_orders_sync_appointment_status on public.service_orders;
create trigger service_orders_sync_appointment_status after update of status on public.service_orders
for each row execute function private.sync_comanda_appointment_status();

create or replace function private.unlink_order_before_appointment_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if old.service_order_id is not null and not exists(
    select 1 from public.appointments other where other.org_id=old.org_id
      and other.service_order_id=old.service_order_id and other.id<>old.id
      and other.status not in ('cancelled','completed')
  ) then
    update public.service_orders set status='cancelled',updated_at=now()
     where org_id=old.org_id and id=old.service_order_id and status not in ('cancelled','closed');
  end if;
  update public.service_orders set appointment_id=null,updated_at=now()
   where org_id=old.org_id and appointment_id=old.id;
  return old;
end;
$$;
drop trigger if exists appointments_unlink_order_before_delete on public.appointments;
create trigger appointments_unlink_order_before_delete before delete on public.appointments
for each row execute function private.unlink_order_before_appointment_delete();

create or replace function private.unlink_appointment_before_order_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  update public.appointments set service_order_id=null,updated_at=now()
   where org_id=old.org_id and service_order_id=old.id;
  return old;
end;
$$;
drop trigger if exists service_orders_unlink_appointment_before_delete on public.service_orders;
create trigger service_orders_unlink_appointment_before_delete before delete on public.service_orders
for each row execute function private.unlink_appointment_before_order_delete();

create or replace function private.enforce_professional_service_order_item()
returns trigger language plpgsql security definer set search_path=''
as $$
declare service_name text; service_price numeric;
begin
  if private.has_org_role(new.org_id,array['professional']) then
    if new.item_type<>'service' or new.service_id is null then raise exception 'Profissionais só podem registrar serviços realizados.'; end if;
    if new.professional_id<>private.current_professional_id(new.org_id) then raise exception 'O serviço deve pertencer ao profissional autenticado.'; end if;
    select s.name,s.price into service_name,service_price from public.services s
     where s.org_id=new.org_id and s.id=new.service_id and s.active=true;
    if service_name is null then raise exception 'Serviço não encontrado ou inativo.'; end if;
    new.description:=service_name; new.quantity:=1; new.unit_price:=service_price;
    new.discount:=0; new.total:=service_price; new.created_by:=(select auth.uid()); new.performed_at:=coalesce(new.performed_at,now());
  end if;
  return new;
end;
$$;
drop trigger if exists service_order_items_enforce_professional on public.service_order_items;
create trigger service_order_items_enforce_professional before insert or update on public.service_order_items
for each row execute function private.enforce_professional_service_order_item();

create or replace function public.start_appointment_service_order(
  p_appointment_id uuid,p_existing_order_id uuid default null,p_force_new boolean default false
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_appt public.appointments%rowtype; v_order public.service_orders%rowtype; v_created boolean:=false; v_user uuid:=(select auth.uid());
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_appt from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if not (
    private.has_org_role(v_appt.org_id,array['owner','admin','manager','receptionist'])
    or private.professional_app_scope(v_appt.org_id)='all'
    or v_appt.professional_id=private.current_professional_id(v_appt.org_id)
  ) then raise exception 'Sem permissão para iniciar este atendimento.'; end if;
  if v_appt.status in ('cancelled','completed','no_show') then raise exception 'Este agendamento não pode iniciar atendimento.'; end if;
  if v_appt.service_id is null then raise exception 'Vincule um serviço ao agendamento antes de iniciar.'; end if;
  if p_existing_order_id is not null then
    select * into v_order from public.service_orders
     where org_id=v_appt.org_id and id=p_existing_order_id and customer_id=v_appt.customer_id
       and status in ('open','in_progress','partially_paid','awaiting_payment') for update;
    if not found then raise exception 'A comanda selecionada não está aberta para este cliente.'; end if;
  elsif not p_force_new and v_appt.service_order_id is not null then
    select * into v_order from public.service_orders where org_id=v_appt.org_id and id=v_appt.service_order_id
      and status in ('open','in_progress','partially_paid','awaiting_payment') for update;
  end if;
  if v_order.id is null then
    insert into public.service_orders(org_id,branch_id,customer_id,appointment_id,assigned_professional_id,status,notes,created_by,created_by_type)
    values(v_appt.org_id,v_appt.branch_id,v_appt.customer_id,v_appt.id,v_appt.professional_id,'in_progress',
      v_appt.notes,v_user,case when private.has_org_role(v_appt.org_id,array['professional']) then 'professional' else 'salon' end)
    returning * into v_order;
    v_created:=true;
  else
    update public.service_orders set status='in_progress',updated_at=now()
     where id=v_order.id and org_id=v_order.org_id returning * into v_order;
  end if;
  if not exists(select 1 from public.service_order_items where org_id=v_appt.org_id and source_appointment_id=v_appt.id) then
    insert into public.service_order_items(org_id,order_id,item_type,service_id,professional_id,source_appointment_id,description,quantity,unit_price,discount,total,performed_at,created_by)
    values(v_appt.org_id,v_order.id,'service',v_appt.service_id,v_appt.professional_id,v_appt.id,
      v_appt.service_name,1,v_appt.price,0,v_appt.price,now(),v_user);
  end if;
  update public.appointments set service_order_id=v_order.id,
    comanda_strategy=case when v_created then 'new_on_arrival' else 'reuse_open' end,
    status='in_progress',arrived_at=coalesce(arrived_at,now()),updated_at=now()
   where org_id=v_appt.org_id and id=v_appt.id;
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'created',v_created,'reused',not v_created,'status',v_order.status);
end;
$$;
revoke all on function public.start_appointment_service_order(uuid,uuid,boolean) from public,anon;
grant execute on function public.start_appointment_service_order(uuid,uuid,boolean) to authenticated;

create or replace function public.register_service_order_payment(p_order_id uuid,p_amount numeric,p_payment_method text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_order public.service_orders%rowtype; v_payment_id uuid; v_cash_id uuid; v_cash_movement_id uuid; v_sale_id uuid;
  v_paid numeric; v_rate numeric; v_item record; v_product public.products%rowtype; v_user uuid:=(select auth.uid()); v_closed boolean:=false;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Informe um valor válido.'; end if;
  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then raise exception 'Forma de pagamento inválida.'; end if;
  select * into v_order from public.service_orders where id=p_order_id for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;
  if not (private.has_org_role(v_order.org_id,array['owner','admin','manager','receptionist']) or private.professional_app_scope(v_order.org_id)='all') then
    raise exception 'Sem permissão para receber pagamento.';
  end if;
  if v_order.status in ('cancelled','closed') then raise exception 'Esta comanda não aceita pagamentos.'; end if;
  if v_order.total<=0 then raise exception 'Adicione serviços ou produtos antes de receber.'; end if;
  select coalesce(sum(amount),0) into v_paid from public.service_order_payments
   where org_id=v_order.org_id and order_id=v_order.id and status='confirmed';
  if v_paid+p_amount>v_order.total+0.01 then raise exception 'O pagamento ultrapassa o saldo da comanda.'; end if;
  select id into v_cash_id from public.cash_registers where org_id=v_order.org_id and status='open'
   and branch_id is not distinct from v_order.branch_id order by opened_at desc limit 1;
  insert into public.service_order_payments(org_id,order_id,branch_id,cash_register_id,amount,payment_method,status,paid_at,created_by)
  values(v_order.org_id,v_order.id,v_order.branch_id,v_cash_id,p_amount,p_payment_method,'confirmed',now(),v_user) returning id into v_payment_id;
  insert into public.cash_movements(org_id,branch_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by)
  values(v_order.org_id,v_order.branch_id,v_cash_id,'income','service_order','Recebimento da comanda #'||v_order.order_number,p_amount,p_payment_method,v_user)
  returning id into v_cash_movement_id;
  update public.service_order_payments set cash_movement_id=v_cash_movement_id where id=v_payment_id;
  v_paid:=v_paid+p_amount;
  if v_paid+0.01>=v_order.total then
    insert into public.sales(org_id,branch_id,customer_id,appointment_id,status,subtotal,discount,total,payment_method,notes,sold_at,created_by)
    values(v_order.org_id,v_order.branch_id,v_order.customer_id,v_order.appointment_id,'completed',v_order.subtotal,v_order.discount,v_order.total,'multiple',
      'Fechamento da comanda #'||v_order.order_number,now(),v_user) returning id into v_sale_id;
    for v_item in select * from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id order by created_at,id loop
      insert into public.sale_items(org_id,sale_id,product_id,service_id,description,quantity,unit_price,discount,total)
      values(v_order.org_id,v_sale_id,v_item.product_id,v_item.service_id,v_item.description,v_item.quantity,v_item.unit_price,v_item.discount,v_item.total);
      if v_item.item_type='product' and v_item.product_id is not null then
        select * into v_product from public.products where org_id=v_order.org_id and id=v_item.product_id for update;
        if not found or v_product.stock_quantity<v_item.quantity then raise exception 'Estoque insuficiente para o produto %.',v_item.description; end if;
        update public.products set stock_quantity=stock_quantity-v_item.quantity,updated_at=now() where org_id=v_order.org_id and id=v_item.product_id;
        insert into public.inventory_movements(org_id,branch_id,product_id,movement_type,quantity,unit_cost,reason,reference_id,created_by)
        values(v_order.org_id,v_order.branch_id,v_item.product_id,'out',v_item.quantity,v_product.cost_price,'Venda pela comanda #'||v_order.order_number,v_order.id,v_user);
      elsif v_item.item_type='service' and v_item.professional_id is not null then
        select cr.rate into v_rate from public.commission_rules cr where cr.org_id=v_order.org_id and cr.active=true
         and (cr.professional_id=v_item.professional_id or cr.professional_id is null)
         and (cr.service_id=v_item.service_id or cr.service_id is null)
         order by (cr.professional_id is not null) desc,(cr.service_id is not null) desc limit 1;
        if v_rate is null then select commission_rate into v_rate from public.professionals where org_id=v_order.org_id and id=v_item.professional_id; end if;
        insert into public.commissions(org_id,professional_id,sale_id,appointment_id,service_order_item_id,base_amount,rate,amount,status)
        values(v_order.org_id,v_item.professional_id,v_sale_id,v_item.source_appointment_id,v_item.id,greatest(v_item.total,0),coalesce(v_rate,0),
          round(greatest(v_item.total,0)*coalesce(v_rate,0)/100,2),'pending')
        on conflict (org_id,service_order_item_id) where service_order_item_id is not null do nothing;
      end if;
    end loop;
    update public.service_orders set status='closed',sale_id=v_sale_id,closed_at=now(),updated_at=now() where org_id=v_order.org_id and id=v_order.id;
    update public.appointments set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
     where org_id=v_order.org_id and service_order_id=v_order.id and status not in ('cancelled','completed');
    v_closed:=true;
  else
    update public.service_orders set status='partially_paid',updated_at=now() where org_id=v_order.org_id and id=v_order.id;
  end if;
  return jsonb_build_object('payment_id',v_payment_id,'cash_movement_id',v_cash_movement_id,'sale_id',v_sale_id,'paid_total',v_paid,
    'balance',greatest(v_order.total-v_paid,0),'closed',v_closed);
end;
$$;
revoke all on function public.register_service_order_payment(uuid,numeric,text) from public,anon;
grant execute on function public.register_service_order_payment(uuid,numeric,text) to authenticated;
