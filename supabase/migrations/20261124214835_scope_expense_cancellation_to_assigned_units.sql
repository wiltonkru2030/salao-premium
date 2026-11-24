-- Restringe o cancelamento de despesas à unidade atribuída ao gerente.
-- A função privada é chamada pelo wrapper público existente; proprietário,
-- administrador e financeiro mantêm o escopo organizacional previsto.
create or replace function private.cancel_expense(p_expense_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_user uuid := (select auth.uid());
  v_exp public.expenses%rowtype;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_exp from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Despesa não encontrada.'; end if;
  if private.has_org_role(v_exp.org_id, array['manager','receptionist'])
     and not private.has_staff_branch_scope(v_exp.org_id, v_exp.branch_id) then
    raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
  end if;
  if not private.has_org_role(v_exp.org_id, array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode cancelar despesas.';
  end if;
  if v_exp.status <> 'pending' then
    raise exception 'Somente despesas pendentes podem ser canceladas.';
  end if;
  update public.expenses set status = 'cancelled'
   where id = v_exp.id and status = 'pending';
  if not found then
    raise exception 'A despesa foi alterada por outra operação. Atualize e tente novamente.';
  end if;
  return jsonb_build_object('expense_id', v_exp.id, 'status', 'cancelled');
end;
$function$;
