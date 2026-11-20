-- RASCUNHO integrado: centavos, snapshot e comissão acumulada. Não aplicar sem QA.
begin;
alter table public.service_order_items
  add column if not exists commission_rate_snapshot numeric(7,4),
  add column if not exists commission_enabled_snapshot boolean;

comment on column public.service_order_items.commission_rate_snapshot is
  'Percentual de comissão congelado no primeiro pagamento confirmado da comanda; NULL indica item ainda não snapshotado.';
comment on column public.service_order_items.commission_enabled_snapshot is
  'Indica se o item era elegível a comissão no primeiro pagamento confirmado; preserva inclusive produto com comissão desabilitada.';

create or replace function private.snapshot_service_order_item_commissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item record;
  v_rate numeric;
  v_enabled boolean;
  v_default_product_rate numeric;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  for v_item in
    select i.*
      from public.service_order_items i
     where i.org_id = new.org_id
       and i.order_id = new.order_id
       and i.commission_enabled_snapshot is null
     order by i.created_at, i.id
     for update
  loop
    -- Não inventar taxa histórica: itens legados com parcelas exigem conciliação prévia.
    if exists (select 1 from public.service_order_payments p where p.org_id=new.org_id and p.order_id=new.order_id and p.status='confirmed' and p.id<>new.id) then
      raise exception 'Comanda com recebimento anterior sem regra de comissão congelada. Solicite a conciliação financeira.';
    end if;
    v_rate := 0;
    v_enabled := false;

    if v_item.professional_id is not null and v_item.item_type = 'service' then
      select cr.rate into v_rate
        from public.commission_rules cr
       where cr.org_id = v_item.org_id
         and cr.active = true
         and cr.item_type = 'service'
         and cr.product_id is null
         and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
         and (cr.service_id = v_item.service_id or cr.service_id is null)
       order by (cr.professional_id is not null) desc,
                (cr.service_id is not null) desc
       limit 1;

      if v_rate is null then
        select p.commission_rate into v_rate
          from public.professionals p
         where p.org_id = v_item.org_id and p.id = v_item.professional_id;
      end if;
      v_enabled := true;

    elsif v_item.professional_id is not null and v_item.item_type = 'product' then
      v_enabled := false;
      v_default_product_rate := null;

      select coalesce((s.setting_value->>'enabled')::boolean, false),
             nullif(s.setting_value->>'default_rate', '')::numeric
        into v_enabled, v_default_product_rate
        from public.app_settings s
       where s.org_id = v_item.org_id
         and s.setting_key = 'product_commission'
         and (s.branch_id is null or s.branch_id is not distinct from (
           select o.branch_id from public.service_orders o
            where o.org_id = new.org_id and o.id = new.order_id
         ))
       order by (s.branch_id is not null) desc
       limit 1;

      if coalesce(v_enabled, false) then
        v_rate := null;
        select cr.rate into v_rate
          from public.commission_rules cr
         where cr.org_id = v_item.org_id
           and cr.active = true
           and cr.item_type = 'product'
           and cr.service_id is null
           and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
           and (cr.product_id = v_item.product_id or cr.product_id is null)
         order by (cr.professional_id is not null) desc,
                  (cr.product_id is not null) desc
         limit 1;

        if v_rate is null then
          select coalesce(v_default_product_rate, p.commission_rate) into v_rate
            from public.professionals p
           where p.org_id = v_item.org_id and p.id = v_item.professional_id;
        end if;
      else
        v_rate := 0;
      end if;
    end if;

    update public.service_order_items
       set commission_rate_snapshot = coalesce(v_rate, 0),
           commission_enabled_snapshot = coalesce(v_enabled, false)
     where org_id = v_item.org_id and id = v_item.id
       and commission_enabled_snapshot is null;
  end loop;

  return new;
end;
$function$;

-- Cálculo acumulado: diferenças de centavos são absorvidas na última parcela.
create or replace function private.accrue_partial_service_order_commissions(p_order_id uuid,p_payment_id uuid,p_amount numeric)
returns void language plpgsql security definer set search_path=''
as $function$
declare
  v_order public.service_orders%rowtype;
  v_item record;
  v_paid numeric;
  v_subtotal numeric;
  v_full_base numeric;
  v_target_base numeric;
  v_prior_base numeric;
  v_prior_amount numeric;
  v_target_amount numeric;
begin
  select * into v_order from public.service_orders where id=p_order_id for update;
  if not found or v_order.total<=0 then raise exception 'Comanda inválida para comissão.'; end if;
  if not exists(select 1 from public.service_order_payments p where p.id=p_payment_id and p.org_id=v_order.org_id and p.order_id=v_order.id and p.amount=p_amount and p.status='confirmed') then
    raise exception 'Recebimento inválido para comissão.';
  end if;
  select sum(amount) into v_paid from public.service_order_payments where org_id=v_order.org_id and order_id=v_order.id and status='confirmed';
  select coalesce(sum(total),0) into v_subtotal from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id;
  if v_subtotal<=0 then return; end if;
  for v_item in
    select i.*, sum(i.total) over(order by i.created_at,i.id) as running_total
    from public.service_order_items i where i.org_id=v_order.org_id and i.order_id=v_order.id
    order by i.created_at,i.id
  loop
    if v_item.commission_enabled_snapshot is null then raise exception 'Regra de comissão não congelada.'; end if;
    if not v_item.commission_enabled_snapshot or v_item.professional_id is null then continue; end if;
    -- Distribui centavos do total uma única vez; cada item progride monotonicamente.
    -- Parcelas podem ter diferença de arredondamento; na quitação as bases totalizam a comanda.
    v_full_base:=round(v_item.running_total*v_order.total/v_subtotal,2)-round((v_item.running_total-v_item.total)*v_order.total/v_subtotal,2);
    v_target_base:=round(v_full_base*v_paid/v_order.total,2);
    v_target_amount:=round(v_target_base*v_item.commission_rate_snapshot/100,2);
    select coalesce(sum(base_amount),0),coalesce(sum(amount),0) into v_prior_base,v_prior_amount
    from public.commissions where org_id=v_order.org_id and service_order_item_id=v_item.id and service_order_payment_id is not null and status<>'cancelled';
    if v_target_base<v_prior_base or v_target_amount<v_prior_amount then raise exception 'Rateio de comissão exige conciliação.'; end if;
    if v_target_base=v_prior_base and v_target_amount=v_prior_amount then continue; end if;
    insert into public.commissions(org_id,professional_id,appointment_id,service_order_item_id,service_order_payment_id,item_type,base_amount,rate,amount,status)
    values(v_order.org_id,v_item.professional_id,coalesce(v_item.source_appointment_id,v_order.appointment_id),v_item.id,p_payment_id,v_item.item_type,v_target_base-v_prior_base,v_item.commission_rate_snapshot,v_target_amount-v_prior_amount,'pending')
    on conflict (org_id,service_order_item_id,service_order_payment_id) where service_order_item_id is not null and service_order_payment_id is not null do nothing;
  end loop;
end;
$function$;
revoke all on function private.accrue_partial_service_order_commissions(uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function private.snapshot_service_order_item_commissions() from public,anon,authenticated;
drop trigger if exists snapshot_service_order_commissions_after_payment on public.service_order_payments;
create trigger snapshot_service_order_commissions_after_payment after insert on public.service_order_payments for each row execute function private.snapshot_service_order_item_commissions();
-- A antiga trigger de inserção recalculava cada parcela isoladamente; a nova rotina usa diferenças acumuladas.
drop trigger if exists enforce_commission_item_snapshot_before_insert on public.commissions;
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
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <= 0 then
    raise exception 'Informe um valor válido.';
  end if;
  if p_amount <> round(p_amount,2) then
    raise exception 'O pagamento deve ter no máximo duas casas decimais.';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
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
  if v_paid + p_amount > v_order.total then
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

  -- Uma única rotina calcula a comissão de todas as parcelas, inclusive a última.
  perform private.accrue_partial_service_order_commissions(v_order.id,v_payment_id,p_amount);

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
commit;
