-- Aplica o escopo de gerente e recepção às consultas e escritas diretas dos módulos.
-- As políticas restritivas compõem a autorização existente. Registros centrais
-- ficam fora do escopo desses papéis enquanto não tiverem uma unidade atribuída.
-- Aplicar após cadastrar os vínculos de unidade e revisar os registros legados.
begin;

create policy branches_staff_branch_scope on public.branches
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, id)
);

create policy customers_staff_branch_scope on public.customers
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy appointments_staff_branch_scope on public.appointments
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy appointment_blocks_staff_branch_scope on public.appointment_blocks
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy cash_registers_staff_branch_scope on public.cash_registers
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy cash_movements_staff_branch_scope on public.cash_movements
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy expenses_staff_branch_scope on public.expenses
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

-- As funções de Caixa a seguir também executam em contexto privilegiado.
-- A verificação explícita reutiliza o papel autenticado e a unidade da operação.
CREATE OR REPLACE FUNCTION private.close_cash_register(p_cash_register_id uuid, p_closing_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_register public.cash_registers%rowtype;
  v_expected numeric(14,2);
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_closing_amount is null or p_closing_amount<0 then raise exception 'Valor contado inválido.'; end if;
  select * into v_register from public.cash_registers where id=p_cash_register_id for update;
  if not found then raise exception 'Caixa não encontrado.'; end if;
  if not private.has_org_role(v_register.org_id,array['owner','admin','manager','receptionist','finance'])
    or (private.has_org_role(v_register.org_id,array['manager','receptionist'])
        and not private.has_staff_branch_scope(v_register.org_id,v_register.branch_id)) then
    raise exception 'Sem permissão para fechar o Caixa.';
  end if;
  if v_register.status<>'open' then raise exception 'Este caixa já foi fechado.'; end if;
  select round(v_register.opening_amount+coalesce(sum(case
    when movement_type='income' and payment_method='cash' then amount
    when movement_type='expense' and payment_method='cash' then -amount
    else 0 end),0),2)
  into v_expected from public.cash_movements
  where org_id=v_register.org_id and cash_register_id=v_register.id;
  update public.cash_registers set closing_amount=round(p_closing_amount,2),
    expected_amount=v_expected,status='closed',closed_by=v_user,closed_at=clock_timestamp()
  where id=v_register.id;
  return jsonb_build_object('cash_register_id',v_register.id,'expected_amount',v_expected,
    'closing_amount',round(p_closing_amount,2),'difference',round(p_closing_amount-v_expected,2),'status','closed');
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_cash_register_summary(p_cash_register_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_register public.cash_registers%rowtype;
  v_cash_income numeric(14,2);
  v_cash_expense numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_register from public.cash_registers where id=p_cash_register_id for share;
  if not found then raise exception 'Caixa não encontrado.'; end if;
  if not private.has_org_role(v_register.org_id,array['owner','admin','manager','receptionist','finance'])
    or (private.has_org_role(v_register.org_id,array['manager','receptionist'])
        and not private.has_staff_branch_scope(v_register.org_id,v_register.branch_id)) then
    raise exception 'Sem permissão para consultar o resumo do Caixa.';
  end if;
  select
    coalesce(sum(amount) filter(where movement_type='income' and payment_method='cash'),0),
    coalesce(sum(amount) filter(where movement_type='expense' and payment_method='cash'),0)
  into v_cash_income,v_cash_expense
  from public.cash_movements where org_id=v_register.org_id and cash_register_id=v_register.id;
  return jsonb_build_object('cash_register_id',v_register.id,
    'cash_income',v_cash_income,'cash_expense',v_cash_expense,
    'cash_net',v_cash_income-v_cash_expense,
    'expected_cash',v_register.opening_amount+v_cash_income-v_cash_expense);
end;
$function$;

CREATE OR REPLACE FUNCTION private.open_cash_register(p_org_id uuid, p_opening_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid());v_id uuid;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 if p_opening_amount is null or p_opening_amount<0 then raise exception 'Valor inicial inválido.'; end if;
 if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance'])
    or (private.has_org_role(p_org_id,array['manager','receptionist'])
        and not private.has_staff_branch_scope(p_org_id,null)) then raise exception 'Sem permissão para abrir o Caixa.'; end if;
 perform 1 from public.organizations where id=p_org_id for update;
 if exists(select 1 from public.cash_registers where org_id=p_org_id and branch_id is null and status='open') then raise exception 'Já existe um caixa aberto para esta unidade.'; end if;
 insert into public.cash_registers(org_id,branch_id,opening_amount,status,opened_by) values(p_org_id,null,p_opening_amount,'open',v_user) returning id into v_id;
 return jsonb_build_object('cash_register_id',v_id,'opening_amount',p_opening_amount,'status','open');
end;
$function$;

CREATE OR REPLACE FUNCTION private.open_cash_register_for_branch(p_org_id uuid, p_branch_id uuid, p_opening_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_register_id uuid;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_opening_amount is null or p_opening_amount < 0 then raise exception 'Valor inicial inválido.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance'])
    or (private.has_org_role(p_org_id,array['manager','receptionist'])
        and not private.has_staff_branch_scope(p_org_id,p_branch_id)) then
    raise exception 'Sem permissão para abrir o Caixa.';
  end if;
  if p_branch_id is null then
    return private.open_cash_register(p_org_id,p_opening_amount);
  end if;
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

CREATE OR REPLACE FUNCTION private.register_cash_movement(p_org_id uuid, p_movement_type text, p_amount numeric, p_payment_method text, p_category text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance'])
    or (private.has_org_role(p_org_id,array['manager','receptionist'])
        and not private.has_staff_branch_scope(p_org_id,null)) then
    raise exception 'Sem permissão para movimentar o Caixa.'; end if;
  select id into v_register from public.cash_registers
   where org_id=p_org_id and branch_id is null and status='open' order by opened_at desc limit 1 for update;
  if v_register is null then raise exception 'Abra o Caixa antes de registrar movimentações.'; end if;
  insert into public.cash_movements(org_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by)
  values(p_org_id,v_register,p_movement_type,p_category,left(btrim(p_description),240),round(p_amount,2),p_payment_method,v_user)
  returning id into v_id;
  return jsonb_build_object('cash_movement_id',v_id,'cash_register_id',v_register);
end $function$;

commit;
