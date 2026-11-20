-- Completa o Caixa por filial e corrige a conferência do dinheiro físico.
-- A abertura por filial é serializada pelo bloqueio da linha da filial.
-- O valor esperado no fechamento considera somente movimentos pagos em dinheiro.
begin;

create or replace function private.open_cash_register_for_branch(
  p_org_id uuid, p_branch_id uuid, p_opening_amount numeric
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_register_id uuid;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_opening_amount is null or p_opening_amount < 0 then raise exception 'Valor inicial inválido.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance']) then
    raise exception 'Sem permissão para abrir o Caixa.';
  end if;

  -- O Caixa central preserva a RPC existente e sua trava por organização.
  if p_branch_id is null then
    return private.open_cash_register(p_org_id,p_opening_amount);
  end if;

  -- Serializa tentativas concorrentes para a mesma filial.
  perform 1 from public.branches
   where org_id=p_org_id and id=p_branch_id and active=true
   for update;
  if not found then raise exception 'Unidade não encontrada ou inativa.'; end if;

  if exists(select 1 from public.cash_registers
     where org_id=p_org_id and branch_id=p_branch_id and status='open') then
    raise exception 'Já existe um caixa aberto para esta unidade.';
  end if;

  insert into public.cash_registers(org_id,branch_id,opening_amount,status,opened_by)
  values(p_org_id,p_branch_id,round(p_opening_amount,2),'open',v_user)
  returning id into v_register_id;

  return jsonb_build_object('cash_register_id',v_register_id,'branch_id',p_branch_id,
    'opening_amount',round(p_opening_amount,2),'status','open');
end;
$function$;

revoke all on function private.open_cash_register_for_branch(uuid,uuid,numeric) from public,anon;
grant execute on function private.open_cash_register_for_branch(uuid,uuid,numeric) to authenticated, service_role;

create function public.open_cash_register_for_branch(
  p_org_id uuid,p_branch_id uuid,p_opening_amount numeric
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.open_cash_register_for_branch($1,$2,$3); $function$;

revoke all on function public.open_cash_register_for_branch(uuid,uuid,numeric) from public,anon;
grant execute on function public.open_cash_register_for_branch(uuid,uuid,numeric) to authenticated, service_role;

-- Resumo financeiro do caixa, limitado ao dinheiro físico.
create function private.get_cash_register_summary(p_cash_register_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_register public.cash_registers%rowtype;
  v_cash_income numeric(14,2);
  v_cash_expense numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_register from public.cash_registers
   where id=p_cash_register_id for share;
  if not found then raise exception 'Caixa não encontrado.'; end if;
  if not private.has_org_role(v_register.org_id,array['owner','admin','manager','receptionist','finance']) then
    raise exception 'Sem permissão para consultar o resumo do Caixa.';
  end if;

  select
    coalesce(sum(amount) filter(where movement_type='income' and payment_method='cash'),0),
    coalesce(sum(amount) filter(where movement_type='expense' and payment_method='cash'),0)
  into v_cash_income,v_cash_expense
  from public.cash_movements
  where org_id=v_register.org_id and cash_register_id=v_register.id;

  return jsonb_build_object('cash_register_id',v_register.id,
    'cash_income',v_cash_income,'cash_expense',v_cash_expense,
    'cash_net',v_cash_income-v_cash_expense,
    'expected_cash',v_register.opening_amount+v_cash_income-v_cash_expense);
end;
$function$;

revoke all on function private.get_cash_register_summary(uuid) from public,anon;
grant execute on function private.get_cash_register_summary(uuid) to authenticated, service_role;

create function public.get_cash_register_summary(p_cash_register_id uuid)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.get_cash_register_summary($1); $function$;

revoke all on function public.get_cash_register_summary(uuid) from public,anon;
grant execute on function public.get_cash_register_summary(uuid) to authenticated, service_role;

-- Valor contado é dinheiro físico: PIX/cartões não entram no saldo esperado.
create or replace function private.close_cash_register(
  p_cash_register_id uuid,p_closing_amount numeric
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_register public.cash_registers%rowtype;
  v_expected numeric(14,2);
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_closing_amount is null or p_closing_amount<0 then raise exception 'Valor contado inválido.'; end if;

  select * into v_register from public.cash_registers
   where id=p_cash_register_id for update;
  if not found then raise exception 'Caixa não encontrado.'; end if;
  if not private.has_org_role(v_register.org_id,array['owner','admin','manager','receptionist','finance']) then
    raise exception 'Sem permissão para fechar o Caixa.';
  end if;
  if v_register.status<>'open' then raise exception 'Este caixa já foi fechado.'; end if;

  select round(v_register.opening_amount+coalesce(sum(case
    when movement_type='income' and payment_method='cash' then amount
    when movement_type='expense' and payment_method='cash' then -amount
    else 0 end),0),2)
  into v_expected
  from public.cash_movements
  where org_id=v_register.org_id and cash_register_id=v_register.id;

  update public.cash_registers
     set closing_amount=round(p_closing_amount,2),expected_amount=v_expected,
         status='closed',closed_by=v_user,closed_at=clock_timestamp()
   where id=v_register.id;

  return jsonb_build_object('cash_register_id',v_register.id,
    'expected_amount',v_expected,'closing_amount',round(p_closing_amount,2),
    'difference',round(p_closing_amount-v_expected,2),'status','closed');
end;
$function$;

commit;
