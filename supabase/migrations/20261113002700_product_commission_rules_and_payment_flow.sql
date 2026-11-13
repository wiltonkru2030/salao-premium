alter table public.commission_rules
  add column if not exists item_type text not null default 'service',
  add column if not exists product_id uuid;

alter table public.commission_rules
  add constraint commission_rules_product_fk
  foreign key (org_id, product_id) references public.products(org_id, id);

alter table public.commission_rules
  add constraint commission_rules_item_type_check
  check (item_type in ('service', 'product'));

alter table public.commission_rules
  add constraint commission_rules_item_target_check
  check ((item_type = 'service' and product_id is null)
      or (item_type = 'product' and service_id is null));

alter table public.commissions
  add column if not exists item_type text not null default 'service';

alter table public.commissions
  add constraint commissions_item_type_check
  check (item_type in ('service', 'product'));

create index if not exists commission_rules_product_lookup_idx
  on public.commission_rules (org_id, item_type, professional_id, product_id)
  where active = true and item_type = 'product';

create or replace function public.register_service_order_payment(
  p_order_id uuid, p_amount numeric, p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.service_orders%rowtype;
  v_payment_id uuid;
  v_cash_id uuid;
  v_cash_movement_id uuid;
  v_sale_id uuid;
  v_paid numeric;
  v_rate numeric;
  v_default_product_rate numeric;
  v_product_commission_enabled boolean := false;
  v_item record;
  v_product public.products%rowtype;
  v_user uuid := (select auth.uid());
  v_closed boolean := false;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor válido.'; end if;
  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select * into v_order from public.service_orders where id = p_order_id for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;
  if not (
    private.has_org_role(v_order.org_id,array['owner','admin','manager','receptionist'])
    or private.professional_app_scope(v_order.org_id) = 'all'
  ) then raise exception 'Sem permissão para receber pagamento.'; end if;
  if v_order.status in ('cancelled','closed') then raise exception 'Esta comanda não aceita pagamentos.'; end if;
  if v_order.total <= 0 then raise exception 'Adicione serviços ou produtos antes de receber.'; end if;

  select coalesce(sum(amount),0) into v_paid
    from public.service_order_payments
   where org_id = v_order.org_id and order_id = v_order.id and status = 'confirmed';
  if v_paid + p_amount > v_order.total + 0.01 then
    raise exception 'O pagamento ultrapassa o saldo da comanda.';
  end if;

  select id into v_cash_id from public.cash_registers
   where org_id = v_order.org_id and status = 'open'
     and branch_id is not distinct from v_order.branch_id
   order by opened_at desc limit 1;

  insert into public.service_order_payments(
    org_id,order_id,branch_id,cash_register_id,amount,payment_method,status,paid_at,created_by
  ) values (
    v_order.org_id,v_order.id,v_order.branch_id,v_cash_id,p_amount,p_payment_method,'confirmed',now(),v_user
  ) returning id into v_payment_id;

  insert into public.cash_movements(
    org_id,branch_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by
  ) values (
    v_order.org_id,v_order.branch_id,v_cash_id,'income','service_order',
    'Recebimento da comanda #' || v_order.order_number,p_amount,p_payment_method,v_user
  ) returning id into v_cash_movement_id;

  update public.service_order_payments set cash_movement_id = v_cash_movement_id where id = v_payment_id;
  v_paid := v_paid + p_amount;

  if v_paid + 0.01 >= v_order.total then
    insert into public.sales(
      org_id,branch_id,customer_id,appointment_id,status,subtotal,discount,total,payment_method,notes,sold_at,created_by
    ) values (
      v_order.org_id,v_order.branch_id,v_order.customer_id,v_order.appointment_id,
      'paid',v_order.subtotal,v_order.discount,v_order.total,'multiple',
      'Fechamento da comanda #' || v_order.order_number,now(),v_user
    ) returning id into v_sale_id;

    for v_item in
      select * from public.service_order_items
       where org_id = v_order.org_id and order_id = v_order.id
       order by created_at,id
    loop
      insert into public.sale_items(
        org_id,sale_id,product_id,service_id,description,quantity,unit_price,discount,total
      ) values (
        v_order.org_id,v_sale_id,v_item.product_id,v_item.service_id,v_item.description,
        v_item.quantity,v_item.unit_price,v_item.discount,v_item.total
      );

      if v_item.item_type = 'product' and v_item.product_id is not null then
        select * into v_product from public.products
         where org_id = v_order.org_id and id = v_item.product_id for update;
        if not found or v_product.stock_quantity < v_item.quantity then
          raise exception 'Estoque insuficiente para o produto %.',v_item.description;
        end if;
        update public.products set stock_quantity = stock_quantity - v_item.quantity,updated_at = now()
         where org_id = v_order.org_id and id = v_item.product_id;
        insert into public.inventory_movements(
          org_id,branch_id,product_id,movement_type,quantity,unit_cost,reason,reference_id,created_by
        ) values (
          v_order.org_id,v_order.branch_id,v_item.product_id,'out',v_item.quantity,v_product.cost_price,
          'Venda pela comanda #' || v_order.order_number,v_order.id,v_user
        );

        if v_item.professional_id is not null then
          v_product_commission_enabled := false;
          v_default_product_rate := null;
          select coalesce((setting_value->>'enabled')::boolean,false),
                 nullif(setting_value->>'default_rate','')::numeric
            into v_product_commission_enabled,v_default_product_rate
            from public.app_settings
           where org_id = v_order.org_id and setting_key = 'product_commission'
             and (branch_id is null or branch_id is not distinct from v_order.branch_id)
           order by (branch_id is not null) desc limit 1;

          if coalesce(v_product_commission_enabled,false) then
            v_rate := null;
            select cr.rate into v_rate from public.commission_rules cr
             where cr.org_id = v_order.org_id and cr.active = true
               and cr.item_type = 'product' and cr.service_id is null
               and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
               and (cr.product_id = v_item.product_id or cr.product_id is null)
             order by (cr.professional_id is not null) desc,(cr.product_id is not null) desc
             limit 1;

            if v_rate is null then
              select coalesce(v_default_product_rate,commission_rate) into v_rate
                from public.professionals
               where org_id = v_order.org_id and id = v_item.professional_id;
            end if;

            insert into public.commissions(
              org_id,professional_id,sale_id,appointment_id,service_order_item_id,
              item_type,base_amount,rate,amount,status
            ) values (
              v_order.org_id,v_item.professional_id,v_sale_id,v_order.appointment_id,v_item.id,
              'product',greatest(v_item.total,0),coalesce(v_rate,0),
              round(greatest(v_item.total,0)*coalesce(v_rate,0)/100,2),'pending'
            ) on conflict (org_id,service_order_item_id)
              where service_order_item_id is not null do nothing;
          end if;
        end if;

      elsif v_item.item_type = 'service' and v_item.professional_id is not null then
        v_rate := null;
        select cr.rate into v_rate from public.commission_rules cr
         where cr.org_id = v_order.org_id and cr.active = true
           and cr.item_type = 'service' and cr.product_id is null
           and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
           and (cr.service_id = v_item.service_id or cr.service_id is null)
         order by (cr.professional_id is not null) desc,(cr.service_id is not null) desc
         limit 1;
        if v_rate is null then
          select commission_rate into v_rate from public.professionals
           where org_id = v_order.org_id and id = v_item.professional_id;
        end if;

        insert into public.commissions(
          org_id,professional_id,sale_id,appointment_id,service_order_item_id,
          item_type,base_amount,rate,amount,status
        ) values (
          v_order.org_id,v_item.professional_id,v_sale_id,v_item.source_appointment_id,v_item.id,
          'service',greatest(v_item.total,0),coalesce(v_rate,0),
          round(greatest(v_item.total,0)*coalesce(v_rate,0)/100,2),'pending'
        ) on conflict (org_id,service_order_item_id)
          where service_order_item_id is not null do nothing;
      end if;
    end loop;

    update public.cash_movements cm set sale_id = v_sale_id
     where cm.org_id = v_order.org_id and cm.id in (
       select p.cash_movement_id from public.service_order_payments p
        where p.org_id = v_order.org_id and p.order_id = v_order.id
          and p.cash_movement_id is not null
     );

    update public.service_orders set status = 'closed',sale_id = v_sale_id,closed_at = now(),updated_at = now()
     where org_id = v_order.org_id and id = v_order.id;
    update public.appointments
       set status = 'completed',completed_at = coalesce(completed_at,now()),updated_at = now()
     where org_id = v_order.org_id and service_order_id = v_order.id
       and status not in ('cancelled','completed');
    v_closed := true;
  else
    update public.service_orders set status = 'partially_paid',updated_at = now()
     where org_id = v_order.org_id and id = v_order.id;
  end if;

  return jsonb_build_object(
    'payment_id',v_payment_id,'cash_movement_id',v_cash_movement_id,'sale_id',v_sale_id,
    'paid_total',v_paid,'balance',greatest(v_order.total-v_paid,0),'closed',v_closed
  );
end;
$function$;

revoke execute on function public.register_service_order_payment(uuid,numeric,text) from public, anon;
grant execute on function public.register_service_order_payment(uuid,numeric,text) to authenticated;
