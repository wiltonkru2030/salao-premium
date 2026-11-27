-- Cálculo incremental em centavos para uma mesma taxa registrada.
-- Preserva valores anteriores, incluindo repasses. Taxas distintas são apuradas separadamente.
-- Não gera débitos corretivos automáticos para divergências históricas.
create or replace function private.incremental_commission_amount(target_org uuid,target_item uuid,applied_rate numeric,new_base numeric)
returns numeric language sql stable security invoker set search_path='' as $$
 select greatest(round((coalesce(sum(c.base_amount),0)+new_base)*applied_rate/100,2)-coalesce(sum(c.amount),0),0)
 from public.commissions c
 where c.org_id=target_org and c.service_order_item_id=target_item and c.service_order_payment_id is not null
 and c.rate=applied_rate and c.status<>'cancelled'
$$;
revoke all on function private.incremental_commission_amount(uuid,uuid,numeric,numeric) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.accrue_partial_service_order_commissions(p_order_id uuid, p_payment_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_order public.service_orders%rowtype;v_item record;v_items_subtotal numeric;
 v_base_total numeric;v_prior_base numeric;v_base numeric;v_rate numeric;v_received numeric;
 v_enabled boolean:=false;v_default_rate numeric;
begin
 select * into v_order from public.service_orders where id=p_order_id for update;
 if not found or v_order.total<=0 then raise exception 'Comanda inválida para cálculo de comissão.'; end if;
 select coalesce(sum(total),0) into v_items_subtotal from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id;
 if v_items_subtotal<=0 then return; end if;
 select coalesce(sum(amount),0) into v_received from public.service_order_payments where org_id=v_order.org_id and order_id=v_order.id and status='confirmed';
 for v_item in select * from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id order by created_at,id loop
  if v_item.professional_id is null then continue; end if;
  v_base_total:=round(greatest(v_item.total,0)*v_order.total/v_items_subtotal,2);
  select coalesce(sum(c.base_amount),0) into v_prior_base from public.commissions c
   where c.org_id=v_order.org_id and c.service_order_item_id=v_item.id and c.service_order_payment_id is not null;
  -- Base acumulada arredondada menos a base já registrada, sem retroagir lançamentos.
  v_base:=greatest(least(v_base_total,round(v_base_total*v_received/v_order.total,2))-v_prior_base,0);
  if v_base<=0 then continue; end if;
  if v_item.item_type='service' then
   v_rate:=null;
   select cr.rate into v_rate from public.commission_rules cr
    where cr.org_id=v_order.org_id and cr.active=true and cr.item_type='service' and cr.product_id is null
      and (cr.professional_id=v_item.professional_id or cr.professional_id is null)
      and (cr.service_id=v_item.service_id or cr.service_id is null)
    order by (cr.professional_id is not null) desc,(cr.service_id is not null) desc limit 1;
   if v_rate is null then select commission_rate into v_rate from public.professionals where org_id=v_order.org_id and id=v_item.professional_id; end if;
  elsif v_item.item_type='product' then
   v_enabled:=false;v_default_rate:=null;
   select coalesce((setting_value->>'enabled')::boolean,false),nullif(setting_value->>'default_rate','')::numeric
    into v_enabled,v_default_rate from public.app_settings
    where org_id=v_order.org_id and setting_key='product_commission'
      and (branch_id is null or branch_id is not distinct from v_order.branch_id)
    order by (branch_id is not null) desc limit 1;
   if not coalesce(v_enabled,false) then continue; end if;
   v_rate:=null;
   select cr.rate into v_rate from public.commission_rules cr
    where cr.org_id=v_order.org_id and cr.active=true and cr.item_type='product' and cr.service_id is null
      and (cr.professional_id=v_item.professional_id or cr.professional_id is null)
      and (cr.product_id=v_item.product_id or cr.product_id is null)
    order by (cr.professional_id is not null) desc,(cr.product_id is not null) desc limit 1;
   if v_rate is null then select coalesce(v_default_rate,commission_rate) into v_rate from public.professionals where org_id=v_order.org_id and id=v_item.professional_id; end if;
  end if;
  insert into public.commissions(org_id,professional_id,appointment_id,service_order_item_id,service_order_payment_id,item_type,base_amount,rate,amount,status)
  values(v_order.org_id,v_item.professional_id,coalesce(v_item.source_appointment_id,v_order.appointment_id),v_item.id,p_payment_id,v_item.item_type,v_base,coalesce(v_rate,0),private.incremental_commission_amount(v_order.org_id,v_item.id,coalesce(v_rate,0),v_base),'pending');
 end loop;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.register_service_order_payment(p_order_id uuid, p_amount numeric, p_payment_method text)
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
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'Informe um valor positivo com até duas casas decimais.' using errcode='22023'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select * into v_order from public.service_orders where id = p_order_id for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;

  if private.has_org_role(v_order.org_id, array['manager','receptionist'])
     and not private.has_staff_branch_scope(v_order.org_id, v_order.branch_id) then
    raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
  end if;
  if not coalesce((
    private.has_org_role(v_order.org_id,array['owner','admin','manager','receptionist'])
    or private.professional_app_scope(v_order.org_id) = 'all'
  ),false) then raise exception 'Sem permissão para receber pagamento.' using errcode='42501'; end if;
  if v_order.status in ('cancelled','closed') then raise exception 'Esta comanda não aceita pagamentos.'; end if;
  if v_order.total <= 0 then raise exception 'Adicione serviços ou produtos antes de receber.'; end if;

  select coalesce(sum(amount),0) into v_paid
    from public.service_order_payments
   where org_id = v_order.org_id and order_id = v_order.id and status = 'confirmed';
  if p_amount > v_order.total - v_paid then
    raise exception 'O pagamento ultrapassa o saldo da comanda.';
  end if;

  select id into v_cash_id
    from public.cash_registers
   where org_id = v_order.org_id
     and status = 'open'
     and (branch_id is not distinct from v_order.branch_id or (branch_id is null and not private.has_org_role(v_order.org_id, array['manager','receptionist'])))
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

  if v_paid = v_order.total then
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
              private.incremental_commission_amount(v_order.org_id,v_item.id,coalesce(v_rate,0),v_item_base),'pending'
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
          private.incremental_commission_amount(v_order.org_id,v_item.id,coalesce(v_rate,0),v_item_base),'pending'
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
$function$
;
;
