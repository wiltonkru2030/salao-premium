-- Abre caixas independentes por filial e mantém compatibilidade com a chamada legada central.
-- A chave única impede duas aberturas simultâneas para a mesma organização/unidade.
create unique index if not exists cash_registers_one_open_central_per_org
  on public.cash_registers (org_id)
  where status = 'open' and branch_id is null;

create unique index if not exists cash_registers_one_open_per_branch
  on public.cash_registers (org_id, branch_id)
  where status = 'open' and branch_id is not null;

create or replace function public.open_cash_register_for_branch(
  p_org_id uuid,
  p_branch_id uuid,
  p_opening_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_register_id uuid;
  v_branch public.branches%rowtype;
begin
  if v_user is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_org_id is null then
    raise exception 'Organização não identificada.';
  end if;

  if p_opening_amount is null
     or p_opening_amount < 0
     or p_opening_amount <> round(p_opening_amount, 2) then
    raise exception 'Valor inicial inválido. Informe no máximo duas casas decimais.';
  end if;

  if not private.has_org_role(
    p_org_id,
    array['owner','admin','manager','receptionist','finance']
  ) then
    raise exception 'Sem permissão para abrir o Caixa.';
  end if;

  if p_branch_id is null then
    -- Serializa a abertura do caixa central da organização.
    perform 1 from public.organizations where id = p_org_id for update;
    if not found then
      raise exception 'Organização não encontrada.';
    end if;
  else
    -- A filial precisa pertencer ao tenant e estar ativa.
    select * into v_branch
      from public.branches
     where id = p_branch_id
       and org_id = p_org_id
       and active = true
     for update;

    if not found then
      raise exception 'Unidade não encontrada, inativa ou fora da organização.';
    end if;
  end if;

  insert into public.cash_registers(
    org_id, branch_id, opening_amount, status, opened_by
  )
  values(
    p_org_id, p_branch_id, round(p_opening_amount, 2), 'open', v_user
  )
  returning id into v_register_id;

  return jsonb_build_object(
    'cash_register_id', v_register_id,
    'org_id', p_org_id,
    'branch_id', p_branch_id,
    'opening_amount', round(p_opening_amount, 2),
    'status', 'open'
  );
exception
  when unique_violation then
    raise exception 'Já existe um caixa aberto para esta unidade.';
end;
$function$;

-- Mantém compatibilidade com clientes antigos: a assinatura antiga abre somente o caixa central.
create or replace function public.open_cash_register(
  p_org_id uuid,
  p_opening_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.open_cash_register_for_branch(p_org_id, null, p_opening_amount);
end;
$function$;

revoke all on function public.open_cash_register_for_branch(uuid, uuid, numeric) from public, anon;
grant execute on function public.open_cash_register_for_branch(uuid, uuid, numeric) to authenticated, service_role;
revoke all on function public.open_cash_register(uuid, numeric) from public, anon;
grant execute on function public.open_cash_register(uuid, numeric) to authenticated, service_role;
