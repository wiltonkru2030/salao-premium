-- 20261116050000_guard_branch_access_in_privileged_rpcs
-- RLS não limita diretamente funções SECURITY DEFINER. Estas verificações
-- reforçam o escopo de unidade dentro das RPCs operacionais existentes.
-- Pré-requisitos: migrations 20261116010000 até 20261116040000.
-- Não aplicar manualmente no Supabase de produção.

DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  -- Despesas pendentes: cancelamento exige acesso à unidade da despesa.
  SELECT pg_get_functiondef('public.cancel_expense(uuid)'::regprocedure)
    INTO v_definition;
  v_old := 'if not private.has_org_role(v_exp.org_id,array[''owner'',''admin'',''manager'',''finance'']) then';
  v_new := 'if not private.has_branch_access(v_exp.org_id,v_exp.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;' || v_old;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de papel em cancel_expense.';
  END IF;
  IF position('private.has_branch_access(v_exp.org_id,v_exp.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;

  -- Despesas pagas: mesma unidade e caixa exato, sem fallback para matriz.
  SELECT pg_get_functiondef('public.pay_expense(uuid,text,boolean)'::regprocedure)
    INTO v_definition;
  v_old := 'if not private.has_org_role(v_exp.org_id,array[''owner'',''admin'',''manager'',''finance'']) then';
  v_new := 'if not private.has_branch_access(v_exp.org_id,v_exp.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;' || v_old;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de papel em pay_expense.';
  END IF;
  IF position('private.has_branch_access(v_exp.org_id,v_exp.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
  END IF;
  v_old := 'and (cr.branch_id is not distinct from v_exp.branch_id or cr.branch_id is null)';
  v_new := 'and cr.branch_id is not distinct from v_exp.branch_id';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar o fallback de Caixa em pay_expense.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  -- Cancelamento e devolução de comandas: validar a filial da Comanda.
  SELECT pg_get_functiondef('public.cancel_service_order(uuid,boolean)'::regprocedure)
    INTO v_definition;
  v_old := 'if not private.has_org_role(v_order.org_id,array[''owner'',''admin'',''manager'',''receptionist'']) then';
  v_new := 'if not private.has_branch_access(v_order.org_id,v_order.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;' || v_old;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de papel em cancel_service_order.';
  END IF;
  IF position('private.has_branch_access(v_order.org_id,v_order.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
  END IF;
  v_old := 'and (branch_id is not distinct from v_order.branch_id or branch_id is null)';
  v_new := 'and branch_id is not distinct from v_order.branch_id';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar o fallback de Caixa em cancel_service_order.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.refund_service_order(uuid,boolean,text)'::regprocedure)
    INTO v_definition;
  v_old := 'if not private.has_org_role(v_order.org_id,array[''owner'',''admin'',''manager'',''finance'']) then';
  v_new := 'if not private.has_branch_access(v_order.org_id,v_order.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;' || v_old;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de papel em refund_service_order.';
  END IF;
  IF position('private.has_branch_access(v_order.org_id,v_order.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
  END IF;
  v_old := 'and (branch_id is not distinct from v_order.branch_id or branch_id is null)';
  v_new := 'and branch_id is not distinct from v_order.branch_id';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar o fallback de Caixa em refund_service_order.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  -- Fechamento do caixa exige autorização para a filial do próprio caixa.
  SELECT pg_get_functiondef('public.close_cash_register(uuid,numeric)'::regprocedure)
    INTO v_definition;
  v_old := 'if not private.has_org_role(v_register.org_id,array[''owner'',''admin'',''manager'',''receptionist'',''finance'']) then';
  v_new := 'if not private.has_branch_access(v_register.org_id,v_register.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;' || v_old;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de papel em close_cash_register.';
  END IF;
  IF position('private.has_branch_access(v_register.org_id,v_register.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;

  -- A RPC atual registra apenas movimentos manuais da matriz.
  SELECT pg_get_functiondef('public.register_cash_movement(uuid,text,numeric,text,text,text)'::regprocedure)
    INTO v_definition;
  v_old := 'if not private.has_org_role(p_org_id,array[''owner'',''admin'',''manager'',''receptionist'',''finance'']) then';
  v_new := 'if not private.has_branch_access(p_org_id,NULL::uuid) then raise exception ''Sem acesso ao Caixa da matriz.''; end if;' || v_old;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de papel em register_cash_movement.';
  END IF;
  IF position('private.has_branch_access(p_org_id,NULL::uuid)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;

  -- Pagamento da Comanda precisa validar a filial antes de inserir recebimentos.
  SELECT pg_get_functiondef('public.register_service_order_payment(uuid,numeric,text)'::regprocedure)
    INTO v_definition;
  v_old := 'if not found then raise exception ''Comanda não encontrada.''; end if;';
  v_new := v_old || ' if not private.has_branch_access(v_order.org_id,v_order.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a leitura inicial da Comanda em register_service_order_payment.';
  END IF;
  IF position('private.has_branch_access(v_order.org_id,v_order.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;

  -- Início de atendimento não pode reutilizar IDs de outra unidade.
  SELECT pg_get_functiondef('public.start_appointment_service_order(uuid,uuid,boolean)'::regprocedure)
    INTO v_definition;
  v_old := 'if not found then raise exception ''Agendamento não encontrado.''; end if;';
  v_new := v_old || ' if not private.has_branch_access(v_appt.org_id,v_appt.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a leitura inicial do Agendamento em start_appointment_service_order.';
  END IF;
  IF position('private.has_branch_access(v_appt.org_id,v_appt.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;

  SELECT pg_get_functiondef('public.start_appointment_group_service_order(uuid,uuid,boolean)'::regprocedure)
    INTO v_definition;
  v_old := 'if not found then raise exception ''Agendamento não encontrado.''; end if;';
  v_new := v_old || ' if not private.has_branch_access(v_first.org_id,v_first.branch_id) then raise exception ''Sem acesso a esta unidade.''; end if;';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a leitura inicial do Agendamento em start_appointment_group_service_order.';
  END IF;
  IF position('private.has_branch_access(v_first.org_id,v_first.branch_id)' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;
END;
$$;

-- Estoque de produtos de uma Comanda não pode ser debitado/devolvido em
-- unidade diferente, mesmo quando a operação passa por uma RPC privilegiada.
DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.register_service_order_payment(uuid,numeric,text)'::regprocedure)
    INTO v_definition;
  v_old := 'if not found or v_product.stock_quantity < v_item.quantity then';
  v_new := 'if not found or v_product.branch_id is distinct from v_order.branch_id or v_product.stock_quantity < v_item.quantity then';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de estoque em register_service_order_payment.';
  END IF;
  IF position('v_product.branch_id is distinct from v_order.branch_id' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;

  SELECT pg_get_functiondef('public.refund_service_order(uuid,boolean,text)'::regprocedure)
    INTO v_definition;
  v_old := 'where org_id=v_order.org_id and id=v_item.product_id;';
  v_new := 'where org_id=v_order.org_id and id=v_item.product_id and branch_id is not distinct from v_order.branch_id;' ||
           ' if not found then raise exception ''O produto não pertence à unidade da Comanda.''; end if;';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a devolução de estoque em refund_service_order.';
  END IF;
  IF position('and branch_id is not distinct from v_order.branch_id;' IN v_definition) = 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END IF;
END;
$$;

-- Funções auxiliares SECURITY DEFINER também devem respeitar o escopo ao
-- responder consultas sobre uma Comanda.
CREATE OR REPLACE FUNCTION private.service_order_financial_state(
  p_org uuid,
  p_order uuid
)
RETURNS TABLE(status text, has_payment boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT o.status,
         EXISTS (
           SELECT 1
           FROM public.service_order_payments p
           WHERE p.org_id = o.org_id
             AND p.order_id = o.id
             AND p.status = 'confirmed'
         )
  FROM public.service_orders o
  WHERE o.org_id = p_org
    AND o.id = p_order
    AND private.has_branch_access(o.org_id, o.branch_id);
$function$;

CREATE OR REPLACE FUNCTION private.professional_has_service_order_item(
  target_org uuid,
  target_order uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_order_items i
    JOIN public.service_orders o
      ON o.org_id = i.org_id
     AND o.id = i.order_id
    WHERE i.org_id = target_org
      AND i.order_id = target_order
      AND private.has_branch_access(o.org_id, o.branch_id)
      AND (
        i.professional_id = private.current_professional_id(target_org)
        OR i.professional_id = private.professional_app_profile_id(target_org)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.professional_is_assigned_to_order(
  target_org uuid,
  target_order uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_orders o
    WHERE o.org_id = target_org
      AND o.id = target_order
      AND private.has_branch_access(o.org_id, o.branch_id)
      AND (
        o.assigned_professional_id = private.current_professional_id(target_org)
        OR o.assigned_professional_id = private.professional_app_profile_id(target_org)
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.service_order_financial_state(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.service_order_financial_state(uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION private.professional_has_service_order_item(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.professional_has_service_order_item(uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION private.professional_is_assigned_to_order(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.professional_is_assigned_to_order(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION private.service_order_financial_state(uuid, uuid) IS
  'Retorna status financeiro somente quando o usuário possui acesso à filial da Comanda.';
