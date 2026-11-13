-- Corrige o vínculo de despesas ao Caixa da própria filial, com fallback
-- controlado para o Caixa central quando a unidade não possuir caixa aberto.
-- A migration é aditiva: não altera registros financeiros existentes.

create or replace function public.pay_expense(
  p_expense_id uuid,
  p_payment_method text,
  p_use_cash boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_exp public.expenses%rowtype;
  v_register uuid;
  v_move uuid;
begin
  if v_user is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select *
    into v_exp
    from public.expenses
   where id = p_expense_id
   for update;

  if not found then
    raise exception 'Despesa não encontrada.';
  end if;

  if not private.has_org_role(v_exp.org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode pagar despesas.';
  end if;

  if v_exp.status <> 'pending' then
    raise exception 'Esta despesa já foi paga ou cancelada.';
  end if;

  if v_exp.amount is null or v_exp.amount <= 0 then
    raise exception 'O valor da despesa precisa ser maior que zero.';
  end if;

  if coalesce(p_use_cash,true) then
    -- Prioriza o Caixa da unidade. Só usa o Caixa central se a unidade
    -- não tiver um aberto. Para despesas sem filial, seleciona o central.
    select cr.id
      into v_register
      from public.cash_registers cr
     where cr.org_id = v_exp.org_id
       and cr.status = 'open'
       and (
         cr.branch_id is not distinct from v_exp.branch_id
         or cr.branch_id is null
       )
     order by
       (cr.branch_id is not null) desc,
       cr.opened_at desc
     limit 1
     for update;

    if v_register is null then
      raise exception 'Abra o Caixa da unidade ou o Caixa central antes de pagar a despesa.';
    end if;

    insert into public.cash_movements(
      org_id,branch_id,cash_register_id,movement_type,category,
      description,amount,payment_method,created_by
    )
    values(
      v_exp.org_id,v_exp.branch_id,v_register,'expense','expense',
      'Despesa: ' || left(v_exp.description,200),
      round(v_exp.amount,2),p_payment_method,v_user
    )
    returning id into v_move;
  end if;

  update public.expenses
     set status = 'paid',
         paid_at = clock_timestamp()
   where id = v_exp.id
     and status = 'pending';

  if not found then
    raise exception 'A despesa foi alterada por outra operação. Atualize e tente novamente.';
  end if;

  return jsonb_build_object(
    'expense_id',v_exp.id,
    'cash_movement_id',v_move,
    'cash_register_id',v_register,
    'status','paid'
  );
end;
$function$;

revoke all on function public.pay_expense(uuid,text,boolean) from public, anon;
grant execute on function public.pay_expense(uuid,text,boolean) to authenticated, service_role;
