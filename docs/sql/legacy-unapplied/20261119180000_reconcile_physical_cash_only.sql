-- Fecha o caixa físico usando somente movimentações em dinheiro.
-- PIX, cartões, transferências e vouchers permanecem no relatório financeiro,
-- mas não alteram o valor que deve existir fisicamente no gaveteiro.
create or replace function public.close_cash_register(
  p_cash_register_id uuid,
  p_closing_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_register public.cash_registers%rowtype;
  v_expected numeric(14,2);
  v_cash_income numeric(14,2);
  v_cash_expense numeric(14,2);
  v_non_cash_income numeric(14,2);
  v_non_cash_expense numeric(14,2);
begin
  if v_user is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_closing_amount is null
     or p_closing_amount < 0
     or p_closing_amount <> round(p_closing_amount, 2) then
    raise exception 'Valor contado inválido. Informe no máximo duas casas decimais.';
  end if;

  select *
    into v_register
    from public.cash_registers
   where id = p_cash_register_id
   for update;

  if not found then
    raise exception 'Caixa não encontrado.';
  end if;

  if not private.has_org_role(
    v_register.org_id,
    array['owner','admin','manager','receptionist','finance']
  ) then
    raise exception 'Sem permissão para fechar o Caixa.';
  end if;

  if v_register.status <> 'open' then
    raise exception 'Este caixa já foi fechado.';
  end if;

  -- A contagem física considera somente dinheiro. Outros meios são
  -- conciliados separadamente e não compõem o saldo esperado do gaveteiro.
  select
    coalesce(sum(amount) filter (
      where movement_type = 'income' and payment_method = 'cash'
    ), 0),
    coalesce(sum(amount) filter (
      where movement_type = 'expense' and payment_method = 'cash'
    ), 0),
    coalesce(sum(amount) filter (
      where movement_type = 'income'
        and payment_method is distinct from 'cash'
    ), 0),
    coalesce(sum(amount) filter (
      where movement_type = 'expense'
        and payment_method is distinct from 'cash'
    ), 0)
  into
    v_cash_income,
    v_cash_expense,
    v_non_cash_income,
    v_non_cash_expense
  from public.cash_movements
  where org_id = v_register.org_id
    and cash_register_id = v_register.id;

  v_expected := round(
    v_register.opening_amount + v_cash_income - v_cash_expense,
    2
  );

  update public.cash_registers
     set closing_amount = round(p_closing_amount, 2),
         expected_amount = v_expected,
         status = 'closed',
         closed_by = v_user,
         closed_at = clock_timestamp()
   where id = v_register.id;

  return jsonb_build_object(
    'cash_register_id', v_register.id,
    'expected_amount', v_expected,
    'cash_income', v_cash_income,
    'cash_expense', v_cash_expense,
    'non_cash_income', v_non_cash_income,
    'non_cash_expense', v_non_cash_expense,
    'closing_amount', round(p_closing_amount, 2),
    'difference', round(p_closing_amount, 2) - v_expected,
    'status', 'closed'
  );
end;
$function$;
