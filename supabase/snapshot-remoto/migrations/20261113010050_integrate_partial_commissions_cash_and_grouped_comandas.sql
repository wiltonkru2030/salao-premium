
alter table public.commissions add column if not exists service_order_payment_id uuid references public.service_order_payments(id) on delete restrict;
drop index if exists public.commissions_order_item_unique;
create unique index if not exists commissions_order_item_legacy_unique on public.commissions(org_id,service_order_item_id) where service_order_item_id is not null and service_order_payment_id is null;
create unique index if not exists commissions_order_item_payment_unique on public.commissions(org_id,service_order_item_id,service_order_payment_id) where service_order_item_id is not null and service_order_payment_id is not null;

alter table public.service_order_payments add column if not exists refund_cash_movement_id uuid references public.cash_movements(id) on delete restrict;
alter table public.service_order_payments add column if not exists refunded_at timestamptz;
alter table public.service_order_payments add column if not exists refunded_by uuid references auth.users(id) on delete set null;
alter table public.cash_movements add column if not exists service_order_id uuid;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='cash_movements_service_order_fk') then
  alter table public.cash_movements add constraint cash_movements_service_order_fk foreign key(org_id,service_order_id) references public.service_orders(org_id,id);
 end if;
end $$;
create index if not exists cash_movements_org_service_order_idx on public.cash_movements(org_id,service_order_id,created_at desc) where service_order_id is not null;

create or replace function private.accrue_partial_service_order_commissions(p_order_id uuid,p_payment_id uuid,p_amount numeric)
returns void language plpgsql security definer set search_path=''
as $function$
declare
 v_order public.service_orders%rowtype;v_item record;v_items_subtotal numeric;
 v_base_total numeric;v_prior_base numeric;v_base numeric;v_rate numeric;
 v_enabled boolean:=false;v_default_rate numeric;
begin
 select * into v_order from public.service_orders where id=p_order_id for update;
 if not found or v_order.total<=0 then raise exception 'Comanda inválida para cálculo de comissão.'; end if;
 select coalesce(sum(total),0) into v_items_subtotal from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id;
 if v_items_subtotal<=0 then return; end if;
 for v_item in select * from public.service_order_items where org_id=v_order.org_id and order_id=v_order.id order by created_at,id loop
  if v_item.professional_id is null then continue; end if;
  v_base_total:=round(greatest(v_item.total,0)*v_order.total/v_items_subtotal,2);
  select coalesce(sum(c.base_amount),0) into v_prior_base from public.commissions c
   where c.org_id=v_order.org_id and c.service_order_item_id=v_item.id and c.service_order_payment_id is not null;
  v_base:=least(greatest(v_base_total-v_prior_base,0),round(v_base_total*p_amount/v_order.total,2));
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
  values(v_order.org_id,v_item.professional_id,coalesce(v_item.source_appointment_id,v_order.appointment_id),v_item.id,p_payment_id,v_item.item_type,v_base,coalesce(v_rate,0),round(v_base*coalesce(v_rate,0)/100,2),'pending');
 end loop;
end;
$function$;
revoke all on function private.accrue_partial_service_order_commissions(uuid,uuid,numeric) from public,anon,authenticated;

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
     and branch_id is not distinct from v_order.branch_id
   order by opened_at desc
   limit 1;

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

create or replace function public.open_cash_register(p_org_id uuid,p_opening_amount numeric)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=(select auth.uid());v_id uuid;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 if p_opening_amount is null or p_opening_amount<0 then raise exception 'Valor inicial inválido.'; end if;
 if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance']) then raise exception 'Sem permissão para abrir o Caixa.'; end if;
 perform 1 from public.organizations where id=p_org_id for update;
 if exists(select 1 from public.cash_registers where org_id=p_org_id and branch_id is null and status='open') then raise exception 'Já existe um caixa aberto para esta unidade.'; end if;
 insert into public.cash_registers(org_id,branch_id,opening_amount,status,opened_by) values(p_org_id,null,p_opening_amount,'open',v_user) returning id into v_id;
 return jsonb_build_object('cash_register_id',v_id,'opening_amount',p_opening_amount,'status','open');
end;
$function$;

create or replace function public.close_cash_register(p_cash_register_id uuid,p_closing_amount numeric)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=(select auth.uid());v_register public.cash_registers%rowtype;v_expected numeric;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 if p_closing_amount is null or p_closing_amount<0 then raise exception 'Valor contado inválido.'; end if;
 select * into v_register from public.cash_registers where id=p_cash_register_id for update;
 if not found then raise exception 'Caixa não encontrado.'; end if;
 if not private.has_org_role(v_register.org_id,array['owner','admin','manager','receptionist','finance']) then raise exception 'Sem permissão para fechar o Caixa.'; end if;
 if v_register.status<>'open' then raise exception 'Este caixa já foi fechado.'; end if;
 select v_register.opening_amount+coalesce(sum(case when movement_type='income' then amount when movement_type='expense' then -amount else 0 end),0)
  into v_expected from public.cash_movements where org_id=v_register.org_id and cash_register_id=v_register.id;
 update public.cash_registers set closing_amount=p_closing_amount,expected_amount=v_expected,status='closed',closed_by=v_user,closed_at=clock_timestamp() where id=v_register.id;
 return jsonb_build_object('cash_register_id',v_register.id,'expected_amount',v_expected,'closing_amount',p_closing_amount,'difference',p_closing_amount-v_expected,'status','closed');
end;
$function$;

create or replace function public.start_appointment_group_service_order(p_appointment_id uuid,p_existing_order_id uuid default null,p_force_new boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_first public.appointments%rowtype;v_row record;v_existing uuid:=p_existing_order_id;v_distinct integer;v_result jsonb;v_count integer:=0;
begin
 select * into v_first from public.appointments where id=p_appointment_id;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
 if v_first.appointment_group_id is null then return public.start_appointment_service_order(p_appointment_id,p_existing_order_id,p_force_new); end if;
 if not private.has_org_role(v_first.org_id,array['owner','admin','manager','receptionist'])
   and private.professional_app_scope(v_first.org_id)<>'all'
   and v_first.professional_id is distinct from private.current_professional_id(v_first.org_id) then
  raise exception 'Sem permissão para iniciar este atendimento.';
 end if;
 select count(distinct service_order_id) into v_distinct from public.appointments
  where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show');
 if v_distinct>1 then raise exception 'Os serviços deste grupo já estão ligados a comandas diferentes. Revise os vínculos antes de continuar.'; end if;
 if v_existing is null and not p_force_new then
  select min(service_order_id) into v_existing from public.appointments
   where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show');
 end if;
 if p_existing_order_id is not null and v_existing is not null and p_existing_order_id<>v_existing then raise exception 'A comanda escolhida não corresponde ao grupo de atendimento.'; end if;
 for v_row in select id from public.appointments where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id
   and status not in ('cancelled','completed','no_show') order by starts_at,id for update
 loop
  v_result:=public.start_appointment_service_order(v_row.id,v_existing,case when v_count=0 then p_force_new else false end);
  v_existing:=(v_result->>'order_id')::uuid;v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Não há serviços ativos neste atendimento.'; end if;
 update public.appointment_groups set status='in_progress',updated_at=now() where org_id=v_first.org_id and id=v_first.appointment_group_id;
 return v_result||jsonb_build_object('service_count',v_count,'group_id',v_first.appointment_group_id);
end;
$function$;

create or replace function public.cancel_service_order(p_order_id uuid,p_refund_payments boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $function$
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
  select id into v_register_id from public.cash_registers where org_id=v_order.org_id and branch_id is not distinct from v_order.branch_id and status='open' order by opened_at desc limit 1;
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
$function$;

revoke all on function public.open_cash_register(uuid,numeric) from public,anon;
revoke all on function public.close_cash_register(uuid,numeric) from public,anon;
revoke all on function public.start_appointment_group_service_order(uuid,uuid,boolean) from public,anon;
revoke all on function public.cancel_service_order(uuid,boolean) from public,anon;
grant execute on function public.open_cash_register(uuid,numeric) to authenticated;
grant execute on function public.close_cash_register(uuid,numeric) to authenticated;
grant execute on function public.start_appointment_group_service_order(uuid,uuid,boolean) to authenticated;
grant execute on function public.cancel_service_order(uuid,boolean) to authenticated;
