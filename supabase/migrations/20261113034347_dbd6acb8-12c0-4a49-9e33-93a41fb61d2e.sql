-- =====================================================================
-- Integridade financeira e operações complementares do Caixa/Estoque.
-- Aditiva: não apaga dados. Remove somente permissões de escrita direta
-- em tabelas financeiras; todas as gravações passam a ocorrer por RPCs
-- SECURITY DEFINER que validam papel, organização e caixa aberto.
-- =====================================================================

-- 1) Escrita direta proibida em registros financeiros e de estoque ---------
drop policy if exists cash_movements_insert_staff on public.cash_movements;
drop policy if exists cash_movements_update_staff on public.cash_movements;
drop policy if exists cash_movements_delete_admin on public.cash_movements;
drop policy if exists cash_registers_insert_staff on public.cash_registers;
drop policy if exists cash_registers_update_staff on public.cash_registers;
drop policy if exists cash_registers_delete_admin on public.cash_registers;
drop policy if exists commissions_insert_admin on public.commissions;
drop policy if exists commissions_update_admin on public.commissions;
drop policy if exists commissions_delete_admin on public.commissions;
drop policy if exists sales_insert_staff on public.sales;
drop policy if exists sales_update_staff on public.sales;
drop policy if exists sales_delete_admin on public.sales;
drop policy if exists sale_items_insert_staff on public.sale_items;
drop policy if exists sale_items_update_staff on public.sale_items;
drop policy if exists sale_items_delete_admin on public.sale_items;
drop policy if exists inventory_movements_insert_admin on public.inventory_movements;
drop policy if exists inventory_movements_update_admin on public.inventory_movements;
drop policy if exists inventory_movements_delete_admin on public.inventory_movements;

revoke insert, update, delete on public.cash_movements, public.cash_registers, public.commissions,
  public.sales, public.sale_items, public.inventory_movements, public.service_order_payments,
  public.commission_payouts, public.commission_payout_items from anon, authenticated;

-- 2) Itens da Comanda: total calculado no banco e bloqueio após recebimento
create or replace function private.guard_service_order_item_write()
returns trigger language plpgsql set search_path = '' as $$
declare v_order_id uuid; v_org uuid; v_status text; v_has_payment boolean;
begin
  -- Gravações feitas por RPCs SECURITY DEFINER (dono do schema) não passam por esta regra.
  if current_user not in ('authenticated','anon') then
    return case when tg_op='DELETE' then old else new end;
  end if;
  v_order_id := case when tg_op='DELETE' then old.order_id else new.order_id end;
  v_org := case when tg_op='DELETE' then old.org_id else new.org_id end;
  select o.status into v_status from public.service_orders o where o.org_id=v_org and o.id=v_order_id;
  if v_status in ('closed','cancelled') then
    raise exception 'Comanda encerrada ou cancelada não pode ser alterada.' using errcode='P0001';
  end if;
  select exists(select 1 from public.service_order_payments p
                 where p.org_id=v_org and p.order_id=v_order_id and p.status='confirmed') into v_has_payment;
  if tg_op in ('UPDATE','DELETE') and v_has_payment then
    raise exception 'Esta comanda já possui recebimentos. Itens existentes não podem ser alterados ou removidos.' using errcode='P0001';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.discount > round(new.quantity*new.unit_price,2) then
    raise exception 'O desconto não pode ser maior que o valor do item.' using errcode='P0001';
  end if;
  new.total := round(greatest(new.quantity*new.unit_price-new.discount,0),2);
  return new;
end $$;
drop trigger if exists service_order_items_guard_financial on public.service_order_items;
create trigger service_order_items_guard_financial before insert or update or delete on public.service_order_items
  for each row execute function private.guard_service_order_item_write();

-- 3) Comanda: status e valores só mudam pelas RPCs/gatilhos do servidor ---
create or replace function private.guard_service_order_direct_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if new.org_id is distinct from old.org_id or new.order_number is distinct from old.order_number
     or new.status is distinct from old.status or new.subtotal is distinct from old.subtotal
     or new.total is distinct from old.total or new.sale_id is distinct from old.sale_id
     or new.closed_at is distinct from old.closed_at then
    raise exception 'Status e valores da comanda são controlados pelos fluxos de pagamento e cancelamento.' using errcode='P0001';
  end if;
  if old.status in ('closed','cancelled') then
    raise exception 'Comanda encerrada ou cancelada não pode ser alterada.' using errcode='P0001';
  end if;
  if new.discount is distinct from old.discount and exists(
     select 1 from public.service_order_payments p where p.org_id=old.org_id and p.order_id=old.id and p.status='confirmed') then
    raise exception 'O desconto não pode ser alterado após o primeiro recebimento.' using errcode='P0001';
  end if;
  return new;
end $$;
drop trigger if exists service_orders_guard_direct_update on public.service_orders;
create trigger service_orders_guard_direct_update before update on public.service_orders
  for each row execute function private.guard_service_order_direct_update();

-- 4) Estoque: quantidade só muda por movimentação rastreada --------------
create or replace function private.guard_product_stock_direct_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') and new.stock_quantity is distinct from old.stock_quantity then
    raise exception 'Use o ajuste de estoque para alterar a quantidade; cada alteração precisa ficar registrada.' using errcode='P0001';
  end if;
  return new;
end $$;
drop trigger if exists products_guard_stock_direct_update on public.products;
create trigger products_guard_stock_direct_update before update on public.products
  for each row execute function private.guard_product_stock_direct_update();

-- 5) Despesas: pagas/canceladas são históricas -----------------------------
create or replace function private.guard_expense_direct_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated','anon') then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if tg_op='INSERT' then
    if new.status<>'pending' or new.paid_at is not null then
      raise exception 'Cadastre a despesa como pendente e registre o pagamento pelo fluxo de pagamento.' using errcode='P0001';
    end if;
    return new;
  end if;
  if old.status<>'pending' then
    raise exception 'Despesa paga ou cancelada não pode ser alterada ou excluída.' using errcode='P0001';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.status<>'pending' or new.paid_at is not null then
    raise exception 'Use as ações Pagar ou Cancelar para mudar a situação da despesa.' using errcode='P0001';
  end if;
  return new;
end $$;
drop trigger if exists expenses_guard_direct_write on public.expenses;
create trigger expenses_guard_direct_write before insert or update or delete on public.expenses
  for each row execute function private.guard_expense_direct_write();

-- 6) Lançamento manual no Caixa (suprimento, sangria, entrada, saída) ----
create or replace function public.register_cash_movement(
  p_org_id uuid, p_movement_type text, p_amount numeric, p_payment_method text,
  p_category text, p_description text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=(select auth.uid()); v_register uuid; v_id uuid;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_movement_type not in ('income','expense') then raise exception 'Tipo de movimentação inválido.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.'; end if;
  if p_category not in ('manual_income','supply','withdrawal','manual_expense','adjustment') then
    raise exception 'Categoria de movimentação inválida.'; end if;
  if nullif(btrim(coalesce(p_description,'')),'') is null then raise exception 'Descreva a movimentação.'; end if;
  if p_movement_type='expense' and not private.has_org_role(p_org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode registrar saídas manuais.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance']) then
    raise exception 'Sem permissão para movimentar o Caixa.'; end if;
  select id into v_register from public.cash_registers
   where org_id=p_org_id and branch_id is null and status='open' order by opened_at desc limit 1 for update;
  if v_register is null then raise exception 'Abra o Caixa antes de registrar movimentações.'; end if;
  insert into public.cash_movements(org_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by)
  values(p_org_id,v_register,p_movement_type,p_category,left(btrim(p_description),240),round(p_amount,2),p_payment_method,v_user)
  returning id into v_id;
  return jsonb_build_object('cash_movement_id',v_id,'cash_register_id',v_register);
end $$;

-- 7) Pagamento e cancelamento de despesas ---------------------------------
create or replace function public.pay_expense(p_expense_id uuid, p_payment_method text, p_use_cash boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=(select auth.uid()); v_exp public.expenses%rowtype; v_register uuid; v_move uuid;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.'; end if;
  select * into v_exp from public.expenses where id=p_expense_id for update;
  if not found then raise exception 'Despesa não encontrada.'; end if;
  if not private.has_org_role(v_exp.org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode pagar despesas.'; end if;
  if v_exp.status<>'pending' then raise exception 'Esta despesa já foi paga ou cancelada.'; end if;
  if coalesce(p_use_cash,true) then
    select id into v_register from public.cash_registers
     where org_id=v_exp.org_id and branch_id is null and status='open' order by opened_at desc limit 1 for update;
    if v_register is null then raise exception 'Abra o Caixa para pagar a despesa por ele.'; end if;
    insert into public.cash_movements(org_id,branch_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by)
    values(v_exp.org_id,v_exp.branch_id,v_register,'expense','expense','Despesa: '||left(v_exp.description,200),v_exp.amount,p_payment_method,v_user)
    returning id into v_move;
  end if;
  update public.expenses set status='paid',paid_at=clock_timestamp() where id=v_exp.id;
  return jsonb_build_object('expense_id',v_exp.id,'cash_movement_id',v_move,'status','paid');
end $$;

create or replace function public.cancel_expense(p_expense_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=(select auth.uid()); v_exp public.expenses%rowtype;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_exp from public.expenses where id=p_expense_id for update;
  if not found then raise exception 'Despesa não encontrada.'; end if;
  if not private.has_org_role(v_exp.org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode cancelar despesas.'; end if;
  if v_exp.status<>'pending' then raise exception 'Somente despesas pendentes podem ser canceladas.'; end if;
  update public.expenses set status='cancelled' where id=v_exp.id;
  return jsonb_build_object('expense_id',v_exp.id,'status','cancelled');
end $$;

-- 8) Ajuste de estoque rastreado -------------------------------------------
create or replace function public.adjust_product_stock(
  p_product_id uuid, p_movement_type text, p_quantity numeric, p_reason text, p_unit_cost numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=(select auth.uid()); v_p public.products%rowtype; v_new numeric; v_delta numeric;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_movement_type not in ('in','out','adjustment') then raise exception 'Tipo de ajuste inválido.'; end if;
  if p_quantity is null or p_quantity<0 or (p_movement_type<>'adjustment' and p_quantity=0) then
    raise exception 'Informe uma quantidade válida.'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo do ajuste.'; end if;
  select * into v_p from public.products where id=p_product_id for update;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not private.is_org_admin(v_p.org_id) then raise exception 'Somente administração pode ajustar o estoque.'; end if;
  v_new := case p_movement_type when 'in' then v_p.stock_quantity+p_quantity
                                when 'out' then v_p.stock_quantity-p_quantity else p_quantity end;
  if v_new<0 then raise exception 'O estoque não pode ficar negativo.'; end if;
  v_delta := abs(v_new-v_p.stock_quantity);
  if v_delta=0 then raise exception 'A quantidade informada é igual ao estoque atual.'; end if;
  update public.products set stock_quantity=v_new,updated_at=clock_timestamp() where id=v_p.id;
  insert into public.inventory_movements(org_id,branch_id,product_id,movement_type,quantity,unit_cost,reason,created_by)
  values(v_p.org_id,v_p.branch_id,v_p.id,p_movement_type,v_delta,coalesce(p_unit_cost,v_p.cost_price),
         left(btrim(p_reason),240)||case when p_movement_type='adjustment' then ' (de '||v_p.stock_quantity||' para '||v_new||')' else '' end,v_user);
  return jsonb_build_object('product_id',v_p.id,'stock_quantity',v_new);
end $$;

-- 9) Devolução de Comanda paga/encerrada -----------------------------------
create or replace function public.refund_service_order(p_order_id uuid, p_return_stock boolean default true, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=(select auth.uid()); v_order public.service_orders%rowtype; v_register uuid; v_payment record;
        v_item record; v_move uuid; v_total numeric:=0; v_count int:=0; v_returned int:=0;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_order from public.service_orders where id=p_order_id for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;
  if not private.has_org_role(v_order.org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode devolver uma comanda paga.'; end if;
  if v_order.status<>'closed' then raise exception 'A devolução se aplica somente a comandas quitadas. Para as demais, use o cancelamento.'; end if;
  if exists(select 1 from public.commissions c join public.service_order_items i on i.id=c.service_order_item_id
             where i.org_id=v_order.org_id and i.order_id=v_order.id and c.status='paid') then
    raise exception 'Há comissões já pagas desta comanda. Faça o ajuste com o profissional antes da devolução.'; end if;
  select id into v_register from public.cash_registers
   where org_id=v_order.org_id and (branch_id is not distinct from v_order.branch_id or branch_id is null) and status='open'
   order by (branch_id is not null) desc,opened_at desc limit 1 for update;
  if v_register is null then raise exception 'Abra o Caixa para registrar a devolução.'; end if;
  for v_payment in select * from public.service_order_payments
                    where org_id=v_order.org_id and order_id=v_order.id and status='confirmed' order by paid_at,id for update loop
    insert into public.cash_movements(org_id,branch_id,cash_register_id,service_order_id,movement_type,category,description,amount,payment_method,created_by)
    values(v_order.org_id,v_order.branch_id,v_register,v_order.id,'expense','service_order_refund',
           'Devolução da Comanda #'||v_order.order_number||coalesce(' · '||nullif(btrim(p_reason),''),''),v_payment.amount,v_payment.payment_method,v_user)
    returning id into v_move;
    update public.service_order_payments set status='refunded',refund_cash_movement_id=v_move,refunded_at=clock_timestamp(),refunded_by=v_user
     where id=v_payment.id;
    v_total:=v_total+v_payment.amount; v_count:=v_count+1;
  end loop;
  update public.commissions c set status='cancelled'
   where c.org_id=v_order.org_id and c.status in ('pending','approved')
     and c.service_order_item_id in (select i.id from public.service_order_items i where i.org_id=v_order.org_id and i.order_id=v_order.id);
  if v_order.sale_id is not null then
    update public.sales set status='refunded' where org_id=v_order.org_id and id=v_order.sale_id;
  end if;
  if coalesce(p_return_stock,true) then
    for v_item in select * from public.service_order_items
                   where org_id=v_order.org_id and order_id=v_order.id and item_type='product' and product_id is not null loop
      update public.products set stock_quantity=stock_quantity+v_item.quantity,updated_at=clock_timestamp()
       where org_id=v_order.org_id and id=v_item.product_id;
      insert into public.inventory_movements(org_id,branch_id,product_id,movement_type,quantity,reason,reference_id,created_by)
      values(v_order.org_id,v_order.branch_id,v_item.product_id,'in',v_item.quantity,'Devolução da comanda #'||v_order.order_number,v_order.id,v_user);
      v_returned:=v_returned+1;
    end loop;
  end if;
  update public.service_orders set status='cancelled',updated_at=clock_timestamp() where id=v_order.id;
  return jsonb_build_object('order_id',v_order.id,'status','cancelled','refunded_amount',v_total,'refunded_payments',v_count,'returned_products',v_returned);
end $$;

revoke all on function public.register_cash_movement(uuid,text,numeric,text,text,text) from public, anon;
revoke all on function public.pay_expense(uuid,text,boolean) from public, anon;
revoke all on function public.cancel_expense(uuid) from public, anon;
revoke all on function public.adjust_product_stock(uuid,text,numeric,text,numeric) from public, anon;
revoke all on function public.refund_service_order(uuid,boolean,text) from public, anon;
grant execute on function public.register_cash_movement(uuid,text,numeric,text,text,text) to authenticated, service_role;
grant execute on function public.pay_expense(uuid,text,boolean) to authenticated, service_role;
grant execute on function public.cancel_expense(uuid) to authenticated, service_role;
grant execute on function public.adjust_product_stock(uuid,text,numeric,text,numeric) to authenticated, service_role;
grant execute on function public.refund_service_order(uuid,boolean,text) to authenticated, service_role;
revoke all on function private.guard_service_order_item_write() from public, anon, authenticated;
revoke all on function private.guard_service_order_direct_update() from public, anon, authenticated;
revoke all on function private.guard_product_stock_direct_update() from public, anon, authenticated;
revoke all on function private.guard_expense_direct_write() from public, anon, authenticated;