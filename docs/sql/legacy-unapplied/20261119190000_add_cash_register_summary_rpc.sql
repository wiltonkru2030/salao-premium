-- Agrega a movimentação do caixa diretamente no Postgres.
-- Evita que a prévia dependa do limite de 500 linhas do histórico da interface.
create or replace function public.get_cash_register_summary(p_cash_register_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_register public.cash_registers%rowtype;
  v_cash_income numeric(14,2) := 0;
  v_cash_expense numeric(14,2) := 0;
  v_non_cash_income numeric(14,2) := 0;
  v_non_cash_expense numeric(14,2) := 0;
begin
  if v_user is null then
    raise exception 'Autenticação necessária.';
  end if;

  select *
    into v_register
    from public.cash_registers
   where id = p_cash_register_id;

  if not found then
    raise exception 'Caixa não encontrado.';
  end if;

  if not private.has_org_role(
    v_register.org_id,
    array['owner','admin','manager','receptionist','finance']
  ) then
    raise exception 'Sem permissão para consultar este caixa.';
  end if;

  select
    coalesce(sum(amount) filter (
      where movement_type = 'income' and payment_method = 'cash'
    ), 0),
    coalesce(sum(amount) filter (
      where movement_type = 'expense' and payment_method = 'cash'
    ), 0),
    coalesce(sum(amount) filter (
      where movement_type = 'income' and payment_method is distinct from 'cash'
    ), 0),
    coalesce(sum(amount) filter (
      where movement_type = 'expense' and payment_method is distinct from 'cash'
    ), 0)
  into v_cash_income, v_cash_expense, v_non_cash_income, v_non_cash_expense
  from public.cash_movements
  where org_id = v_register.org_id
    and cash_register_id = v_register.id;

  return jsonb_build_object(
    'cash_register_id', v_register.id,
    'branch_id', v_register.branch_id,
    'cash_income', round(v_cash_income, 2),
    'cash_expense', round(v_cash_expense, 2),
    'non_cash_income', round(v_non_cash_income, 2),
    'non_cash_expense', round(v_non_cash_expense, 2),
    'expected_cash', round(v_register.opening_amount + v_cash_income - v_cash_expense, 2)
  );
end;
$function$;

revoke all on function public.get_cash_register_summary(uuid) from public, anon;
grant execute on function public.get_cash_register_summary(uuid) to authenticated, service_role;
