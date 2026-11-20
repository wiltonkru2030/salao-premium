-- Candidata de validação de entradas; preservar rotinas de auditoria e caixa existentes.
-- Testar em QA antes de implantar no banco financeiro.
begin;
CREATE OR REPLACE FUNCTION private.pay_expense(p_expense_id uuid, p_payment_method text, p_use_cash boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_exp public.expenses%rowtype;
  v_register uuid;
  v_move uuid;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  select * into v_exp from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Despesa não encontrada.'; end if;
  if not private.has_org_role(v_exp.org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode pagar despesas.';
  end if;
  if v_exp.status <> 'pending' then raise exception 'Esta despesa já foi paga ou cancelada.'; end if;
  if v_exp.amount is null or v_exp.amount::text in ('NaN','Infinity','-Infinity') or v_exp.amount <= 0 then
    raise exception 'O valor da despesa precisa ser maior que zero.';
  end if;
  if coalesce(p_use_cash,true) then
    select cr.id into v_register
      from public.cash_registers cr
     where cr.org_id = v_exp.org_id and cr.status = 'open'
       and (cr.branch_id is not distinct from v_exp.branch_id or cr.branch_id is null)
     order by (cr.branch_id is not null) desc, cr.opened_at desc
     limit 1 for update;
    if v_register is null then
      raise exception 'Abra o Caixa da unidade ou o Caixa central antes de pagar a despesa.';
    end if;
    insert into public.cash_movements(
      org_id,branch_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by
    ) values(
      v_exp.org_id,v_exp.branch_id,v_register,'expense','expense',
      'Despesa: ' || left(v_exp.description,200),round(v_exp.amount,2),p_payment_method,v_user
    ) returning id into v_move;
  end if;
  update public.expenses set status='paid',paid_at=clock_timestamp()
   where id=v_exp.id and status='pending';
  if not found then
    raise exception 'A despesa foi alterada por outra operação. Atualize e tente novamente.';
  end if;
  return jsonb_build_object(
    'expense_id',v_exp.id,'cash_movement_id',v_move,
    'cash_register_id',v_register,'status','paid'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.adjust_product_stock(p_product_id uuid, p_movement_type text, p_quantity numeric, p_reason text, p_unit_cost numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid()); v_p public.products%rowtype; v_new numeric; v_delta numeric;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_movement_type is null or p_movement_type not in ('in','out','adjustment') then raise exception 'Tipo de ajuste inválido.'; end if;
  if p_quantity is null or p_quantity::text in ('NaN','Infinity','-Infinity') or p_quantity<0 or p_quantity<>round(p_quantity,3) or p_quantity>999999999.999 or (p_movement_type<>'adjustment' and p_quantity=0) then
    raise exception 'Informe uma quantidade válida.'; end if;
  if p_unit_cost is not null and (p_unit_cost::text in ('NaN','Infinity','-Infinity') or p_unit_cost<0 or p_unit_cost<>round(p_unit_cost,2) or p_unit_cost>9999999999.99) then raise exception 'Informe um custo unitário válido, com até duas casas decimais.' using errcode='22023'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo do ajuste.'; end if;
  select * into v_p from public.products where id=p_product_id for update;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not private.is_org_admin(v_p.org_id) then raise exception 'Somente administração pode ajustar o estoque.'; end if;
  v_new := case p_movement_type when 'in' then v_p.stock_quantity+p_quantity
                                when 'out' then v_p.stock_quantity-p_quantity else p_quantity end;
  if v_new>999999999.999 then raise exception 'A quantidade excede o limite do estoque.' using errcode='22023'; end if;
  if v_new<0 then raise exception 'O estoque não pode ficar negativo.'; end if;
  v_delta := abs(v_new-v_p.stock_quantity);
  if v_delta=0 then raise exception 'A quantidade informada é igual ao estoque atual.'; end if;
  update public.products set stock_quantity=v_new,updated_at=clock_timestamp() where id=v_p.id;
  insert into public.inventory_movements(org_id,branch_id,product_id,movement_type,quantity,unit_cost,reason,created_by)
  values(v_p.org_id,v_p.branch_id,v_p.id,p_movement_type,v_delta,coalesce(p_unit_cost,v_p.cost_price),
         left(btrim(p_reason),240)||case when p_movement_type='adjustment' then ' (de '||v_p.stock_quantity||' para '||v_new||')' else '' end,v_user);
  return jsonb_build_object('product_id',v_p.id,'stock_quantity',v_new);
end $function$;
commit;
