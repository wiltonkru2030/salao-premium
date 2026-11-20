-- Corrige a quitação final da Comanda: o lançamento de comissão de serviço tinha 11 valores para
-- 10 colunas (faltava service_order_payment_id), o que impedia qualquer pagamento final.
CREATE OR REPLACE FUNCTION public.register_service_order_payment(p_order_id uuid, p_amount numeric, p_payment_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_items_subtotal numeric := 0;
  v_item_base_total numeric := 0;
  v_item_base numeric := 0;
  v_prior_base numeric := 0;
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

  select id into v_cash_id
    from public.cash_registers
   where org_id = v_order.org_id
     and status = 'open'
     and (branch_id is not distinct from v_order.branch_id or branch_id is null)
   order by (branch_id is not null) desc,opened_at desc
   limit 1 for update;
  if v_cash_id is null then raise exception 'Abra o Caixa antes de receber pagamentos.'; end if;

  insert into public.service_order_payments(
    org_id,order_id,branch_id,cash_register_id,amount,payment_method,status,paid_at,created_by
  ) values (
    v_order.org_id,v_order.id,v_order.branch_id,v_cash_id,p_amount,p_payment_method,'confirmed',now(),v_user
  ) returning id into v_payment_id;

  -- Cada recebimento gera sua própria entrada no Caixa, inclusive pagamentos parciais.
  insert into public.cash_movements(
    org_id,branch_id,cash_register_id,service_order_id,movement_type,category,description,amount,payment_method,created_by
  ) values (
    v_order.org_id,v_order.branch_id,v_cash_id,v_order.id,'income','service_order',
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

    select coalesce(sum(total),0) into v_items_subtotal
      from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id;
    for v_item in
      select * from public.service_order_items
       where org_id = v_order.org_id and order_id = v_order.id
       order by created_at,id
    loop
      v_item_base_total := case when v_items_subtotal>0
        then round(greatest(v_item.total,0)*v_order.total/v_items_subtotal,2) else 0 end;
      select coalesce(sum(c.base_amount),0) into v_prior_base
        from public.commissions c
       where c.org_id=v_order.org_id and c.service_order_item_id=v_item.id
         and c.service_order_payment_id is not null;
      v_item_base := greatest(v_item_base_total-v_prior_base,0);
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
        update public.products
           set stock_quantity = stock_quantity - v_item.quantity, updated_at = now()
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
           where org_id = v_order.org_id
             and setting_key = 'product_commission'
             and (branch_id is null or branch_id is not distinct from v_order.branch_id)
           order by (branch_id is not null) desc
           limit 1;

          if coalesce(v_product_commission_enabled,false) then
            v_rate := null;
            select cr.rate into v_rate
              from public.commission_rules cr
             where cr.org_id = v_order.org_id
               and cr.active = true
               and cr.item_type = 'product'
               and cr.service_id is null
               and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
               and (cr.product_id = v_item.product_id or cr.product_id is null)
             order by (cr.professional_id is not null) desc,
                      (cr.product_id is not null) desc
             limit 1;
            if v_rate is null then
              select coalesce(v_default_product_rate,commission_rate) into v_rate
                from public.professionals
               where org_id = v_order.org_id and id = v_item.professional_id;
            end if;

            insert into public.commissions(
              org_id,professional_id,sale_id,appointment_id,service_order_item_id,service_order_payment_id,
              item_type,base_amount,rate,amount,status
            ) values (
              v_order.org_id,v_item.professional_id,v_sale_id,v_order.appointment_id,v_item.id,v_payment_id,
              'product',v_item_base,coalesce(v_rate,0),
              round(v_item_base*coalesce(v_rate,0)/100,2),'pending'
            ) on conflict (org_id,service_order_item_id,service_order_payment_id)
              where service_order_item_id is not null and service_order_payment_id is not null do nothing;
          end if;
        end if;

      elsif v_item.item_type = 'service' and v_item.professional_id is not null then
        v_rate := null;
        select cr.rate into v_rate
          from public.commission_rules cr
         where cr.org_id = v_order.org_id
           and cr.active = true
           and cr.item_type = 'service'
           and cr.product_id is null
           and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
           and (cr.service_id = v_item.service_id or cr.service_id is null)
         order by (cr.professional_id is not null) desc,
                  (cr.service_id is not null) desc
         limit 1;
        if v_rate is null then
          select commission_rate into v_rate
            from public.professionals
           where org_id = v_order.org_id and id = v_item.professional_id;
        end if;

        insert into public.commissions(
          org_id,professional_id,sale_id,appointment_id,service_order_item_id,service_order_payment_id,
          item_type,base_amount,rate,amount,status
        ) values (
          v_order.org_id,v_item.professional_id,v_sale_id,coalesce(v_item.source_appointment_id,v_order.appointment_id),v_item.id,v_payment_id,
          'service',v_item_base,coalesce(v_rate,0),
          round(v_item_base*coalesce(v_rate,0)/100,2),'pending'
        ) on conflict (org_id,service_order_item_id,service_order_payment_id)
          where service_order_item_id is not null and service_order_payment_id is not null do nothing;
      end if;
    end loop;

    update public.commissions c set sale_id=v_sale_id
     where c.org_id=v_order.org_id
       and c.service_order_item_id in (
         select i.id from public.service_order_items i
          where i.org_id=v_order.org_id and i.order_id=v_order.id
       );
    update public.cash_movements cm
       set sale_id = v_sale_id
     where cm.org_id = v_order.org_id
       and cm.id in (
         select p.cash_movement_id from public.service_order_payments p
          where p.org_id = v_order.org_id and p.order_id = v_order.id and p.cash_movement_id is not null
       );

    update public.service_orders
       set status = 'closed',sale_id = v_sale_id,closed_at = now(),updated_at = now()
     where org_id = v_order.org_id and id = v_order.id;
    update public.appointments
       set status = 'completed',completed_at = coalesce(completed_at,now()),updated_at = now()
     where org_id = v_order.org_id
       and service_order_id = v_order.id
       and status not in ('cancelled','completed');
    v_closed := true;
  else
    perform private.accrue_partial_service_order_commissions(v_order.id,v_payment_id,p_amount);
    update public.service_orders
       set status = 'partially_paid',updated_at = now()
     where org_id = v_order.org_id and id = v_order.id;
  end if;

  return jsonb_build_object(
    'payment_id',v_payment_id,'cash_movement_id',v_cash_movement_id,'sale_id',v_sale_id,
    'paid_total',v_paid,'balance',greatest(v_order.total-v_paid,0),'closed',v_closed
  );
end;
$function$;

-- Consulta do estado financeiro da Comanda para o gatilho de proteção dos itens, sem depender
-- das permissões de leitura do usuário (profissionais não leem pagamentos).
create or replace function private.service_order_financial_state(p_org uuid, p_order uuid)
returns table(status text, has_payment boolean)
language sql stable security definer set search_path = '' as $$
  select o.status, exists(select 1 from public.service_order_payments p
                           where p.org_id=o.org_id and p.order_id=o.id and p.status='confirmed')
    from public.service_orders o where o.org_id=p_org and o.id=p_order
$$;
revoke all on function private.service_order_financial_state(uuid,uuid) from public, anon;
grant execute on function private.service_order_financial_state(uuid,uuid) to authenticated;

create or replace function private.guard_service_order_item_write()
returns trigger language plpgsql set search_path = '' as $$
declare v_order_id uuid; v_org uuid; v_status text; v_has_payment boolean;
begin
  if current_user not in ('authenticated','anon') then
    return case when tg_op='DELETE' then old else new end;
  end if;
  v_order_id := case when tg_op='DELETE' then old.order_id else new.order_id end;
  v_org := case when tg_op='DELETE' then old.org_id else new.org_id end;
  select s.status, s.has_payment into v_status, v_has_payment from private.service_order_financial_state(v_org, v_order_id) s;
  if v_status in ('closed','cancelled') then
    raise exception 'Comanda encerrada ou cancelada não pode ser alterada.' using errcode='P0001';
  end if;
  if tg_op in ('UPDATE','DELETE') and coalesce(v_has_payment,false) then
    raise exception 'Esta comanda já possui recebimentos. Itens existentes não podem ser alterados ou removidos.' using errcode='P0001';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.discount > round(new.quantity*new.unit_price,2) then
    raise exception 'O desconto não pode ser maior que o valor do item.' using errcode='P0001';
  end if;
  new.total := round(greatest(new.quantity*new.unit_price-new.discount,0),2);
  return new;
end $$;