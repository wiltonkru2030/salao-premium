-- 20261113010702_use_default_cash_register_for_branch_transactions
-- Usa o caixa da filial quando aberto e, na ausência dele, o caixa padrão da organização.
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

  select * into v_order
    from public.service_orders
   where id = p_order_id
   for update;
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

  update public.service_order_payments
     set cash_movement_id = v_cash_movement_id
   where id = v_payment_id;
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
        select * into v_product
          from public.products
         where org_id = v_order.org_id and id = v_item.product_id
         for update;
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
              select coalesce(v_default_product_rate,commission_rate)
                into v_rate
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
          org_id,professional_id,sale_id,appointment_id,service_order_item_id,
          item_type,base_amount,rate,amount,status
        ) values (
          v_order.org_id,v_item.professional_id,v_sale_id,v_item.source_appointment_id,v_item.id,v_payment_id,
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
         select p.cash_movement_id
           from public.service_order_payments p
          where p.org_id = v_order.org_id
            and p.order_id = v_order.id
            and p.cash_movement_id is not null
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
CREATE OR REPLACE FUNCTION public.pay_professional_commissions(p_org_id uuid, p_professional_id uuid, p_commission_ids uuid[], p_payment_method text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid:=(select auth.uid());
  v_branch_id uuid;
  v_register_id uuid;
  v_payout_id uuid;
  v_cash_movement_id uuid;
  v_amount numeric(12,2):=0;
  v_count integer:=0;
  v_expected integer;
  v_comm record;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_commission_ids is null or cardinality(p_commission_ids)=0 then
    raise exception 'Selecione pelo menos uma comissão.';
  end if;
  if cardinality(p_commission_ids)<>(select count(distinct item) from unnest(p_commission_ids) as u(item)) then
    raise exception 'A seleção contém comissões repetidas.';
  end if;
  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode pagar comissões.';
  end if;

  select count(*) into v_expected from unnest(p_commission_ids);
  select p.branch_id into v_branch_id from public.professionals p
   where p.org_id=p_org_id and p.id=p_professional_id and p.active=true;
  if not found then raise exception 'Profissional não encontrado ou inativo.'; end if;

  for v_comm in
    select c.id,c.amount
      from public.commissions c
     where c.org_id=p_org_id and c.professional_id=p_professional_id
       and c.id=any(p_commission_ids)
       and c.status in ('pending','approved')
       and c.payout_id is null
     order by c.created_at,c.id
     for update
  loop
    v_count:=v_count+1;
    v_amount:=v_amount+v_comm.amount;
  end loop;
  if v_count<>v_expected then
    raise exception 'Uma ou mais comissões não estão pendentes, pertencem a outro profissional ou já foram pagas.';
  end if;
  if v_amount<=0 then raise exception 'O valor total das comissões deve ser maior que zero.'; end if;

  select cr.id into v_register_id
    from public.cash_registers cr
   where cr.org_id=p_org_id and cr.status='open'
     and (cr.branch_id is not distinct from v_branch_id or cr.branch_id is null)
   order by (cr.branch_id is not null) desc,cr.opened_at desc
   limit 1 for update;
  if v_register_id is null then raise exception 'Abra o Caixa da unidade antes de pagar comissões.'; end if;

  insert into public.commission_payouts(
    org_id,professional_id,branch_id,cash_register_id,amount,payment_method,notes,paid_by
  ) values(
    p_org_id,p_professional_id,v_branch_id,v_register_id,v_amount,p_payment_method,
    nullif(btrim(p_notes),''),v_user
  ) returning id into v_payout_id;

  insert into public.cash_movements(
    org_id,branch_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by
  ) values(
    p_org_id,v_branch_id,v_register_id,'expense','professional_commission',
    'Pagamento de comissão ao profissional',v_amount,p_payment_method,v_user
  ) returning id into v_cash_movement_id;

  update public.commission_payouts set cash_movement_id=v_cash_movement_id
   where org_id=p_org_id and id=v_payout_id;

  for v_comm in
    select c.id,c.amount
      from public.commissions c
     where c.org_id=p_org_id and c.professional_id=p_professional_id
       and c.id=any(p_commission_ids)
     order by c.created_at,c.id
  loop
    insert into public.commission_payout_items(org_id,payout_id,commission_id,amount)
    values(p_org_id,v_payout_id,v_comm.id,v_comm.amount);
  end loop;

  update public.commissions
     set status='paid',paid_at=clock_timestamp(),payout_id=v_payout_id
   where org_id=p_org_id and professional_id=p_professional_id
     and id=any(p_commission_ids) and status in ('pending','approved') and payout_id is null;

  return jsonb_build_object(
    'payout_id',v_payout_id,'cash_movement_id',v_cash_movement_id,
    'professional_id',p_professional_id,'amount',v_amount,
    'commission_count',v_count,'paid_at',clock_timestamp()
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_service_order(p_order_id uuid, p_refund_payments boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid());v_order public.service_orders%rowtype;v_payment record;v_register_id uuid;v_refund_total numeric:=0;v_refund_count integer:=0;v_movement uuid;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 select * into v_order from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'Comanda não encontrada.'; end if;
 if not private.has_org_role(v_order.org_id,array['owner','admin','manager','receptionist']) then raise exception 'Sem permissão para cancelar esta comanda.'; end if;
 if v_order.status in ('closed','cancelled') then raise exception 'Esta comanda não pode ser cancelada por este fluxo.'; end if;
 if exists(select 1 from public.commissions c join public.service_order_items i on i.id=c.service_order_item_id where i.org_id=v_order.org_id and i.order_id=v_order.id and c.status='paid') then
  raise exception 'Há comissões já pagas. Faça o ajuste financeiro das comissões antes de cancelar.';
 end if;
 if exists(select 1 from public.service_order_payments p where p.org_id=v_order.org_id and p.order_id=v_order.id and p.status='confirmed') then
  if not p_refund_payments then raise exception 'Esta comanda tem recebimentos. Confirme o estorno integral para cancelar.'; end if;
  if not private.has_org_role(v_order.org_id,array['owner','admin','manager','finance']) then raise exception 'Somente administração ou financeiro pode estornar pagamentos.'; end if;
  select id into v_register_id from public.cash_registers where org_id=v_order.org_id and (branch_id is not distinct from v_order.branch_id or branch_id is null) and status='open' order by (branch_id is not null) desc,opened_at desc limit 1 for update;
  if v_register_id is null then raise exception 'Abra o Caixa da unidade para registrar os estornos.'; end if;
  for v_payment in select * from public.service_order_payments where org_id=v_order.org_id and order_id=v_order.id and status='confirmed' order by paid_at,id for update loop
   insert into public.cash_movements(org_id,branch_id,cash_register_id,service_order_id,movement_type,category,description,amount,payment_method,created_by)
   values(v_order.org_id,v_order.branch_id,v_register_id,v_order.id,'expense','service_order_refund','Estorno do pagamento da Comanda #'||v_order.order_number,v_payment.amount,v_payment.payment_method,v_user)
   returning id into v_movement;
   update public.service_order_payments set status='refunded',refund_cash_movement_id=v_movement,refunded_at=clock_timestamp(),refunded_by=v_user where id=v_payment.id;
   v_refund_total:=v_refund_total+v_payment.amount;v_refund_count:=v_refund_count+1;
  end loop;
  update public.commissions c set status='cancelled'
   where c.org_id=v_order.org_id and c.status in ('pending','approved')
     and c.service_order_payment_id in (select p.id from public.service_order_payments p where p.org_id=v_order.org_id and p.order_id=v_order.id and p.status='refunded');
 end if;
 update public.service_orders set status='cancelled',updated_at=clock_timestamp() where org_id=v_order.org_id and id=v_order.id;
 update public.appointments set status='cancelled',cancelled_at=coalesce(cancelled_at,clock_timestamp())
  where org_id=v_order.org_id and service_order_id=v_order.id and status not in ('cancelled','completed','no_show');
 update public.appointment_groups g set status='cancelled',updated_at=clock_timestamp()
  where g.org_id=v_order.org_id and exists(select 1 from public.appointments a where a.org_id=v_order.org_id and a.appointment_group_id=g.id and a.service_order_id=v_order.id)
    and not exists(select 1 from public.appointments a where a.org_id=v_order.org_id and a.appointment_group_id=g.id and a.status not in ('cancelled','completed','no_show'));
 return jsonb_build_object('order_id',v_order.id,'status','cancelled','refunded_amount',v_refund_total,'refunded_payments',v_refund_count);
end;
$function$
;
