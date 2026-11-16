-- 20261116010000_scope_cash_and_commissions_by_branch
-- Escopo explícito de filial no Caixa e no ledger de comissões.
-- Esta migration é versionada na branch; não executar manualmente em produção.

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commissions_branch_id_fkey'
      AND conrelid = 'public.commissions'::regclass
  ) THEN
    ALTER TABLE public.commissions
      ADD CONSTRAINT commissions_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- Recupera a unidade de origem pela Comanda; não infere unidade para registros legados
-- sem vínculo de item, preservando o significado de NULL (matriz/legado).
UPDATE public.commissions c
SET branch_id = so.branch_id
FROM public.service_order_items i
JOIN public.service_orders so
  ON so.org_id = i.org_id AND so.id = i.order_id
WHERE c.org_id = i.org_id
  AND c.service_order_item_id = i.id
  AND c.branch_id IS NULL
  AND so.branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commissions_org_branch_status_idx
  ON public.commissions(org_id, branch_id, status, created_at DESC);

-- O ledger de comissões parciais precisa carregar a unidade da Comanda.
CREATE OR REPLACE FUNCTION private.accrue_partial_service_order_commissions(
  p_order_id uuid, p_payment_id uuid, p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order public.service_orders%rowtype;
  v_item record;
  v_items_subtotal numeric;
  v_base_total numeric;
  v_prior_base numeric;
  v_base numeric;
  v_rate numeric;
  v_enabled boolean := false;
  v_default_rate numeric;
BEGIN
  SELECT * INTO v_order
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.total <= 0 THEN
    RAISE EXCEPTION 'Comanda inválida para cálculo de comissão.';
  END IF;

  SELECT coalesce(sum(total), 0) INTO v_items_subtotal
  FROM public.service_order_items
  WHERE org_id = v_order.org_id AND order_id = v_order.id;

  IF v_items_subtotal <= 0 THEN RETURN; END IF;

  FOR v_item IN
    SELECT * FROM public.service_order_items
    WHERE org_id = v_order.org_id AND order_id = v_order.id
    ORDER BY created_at, id
  LOOP
    IF v_item.professional_id IS NULL THEN CONTINUE; END IF;

    v_base_total := round(greatest(v_item.total, 0) * v_order.total / v_items_subtotal, 2);
    SELECT coalesce(sum(c.base_amount), 0) INTO v_prior_base
    FROM public.commissions c
    WHERE c.org_id = v_order.org_id
      AND c.service_order_item_id = v_item.id
      AND c.service_order_payment_id IS NOT NULL;

    v_base := least(
      greatest(v_base_total - v_prior_base, 0),
      round(v_base_total * p_amount / v_order.total, 2)
    );
    IF v_base <= 0 THEN CONTINUE; END IF;

    IF v_item.item_type = 'service' THEN
      v_rate := NULL;
      SELECT cr.rate INTO v_rate
      FROM public.commission_rules cr
      WHERE cr.org_id = v_order.org_id
        AND cr.active = true
        AND cr.item_type = 'service'
        AND cr.product_id IS NULL
        AND (cr.professional_id = v_item.professional_id OR cr.professional_id IS NULL)
        AND (cr.service_id = v_item.service_id OR cr.service_id IS NULL)
      ORDER BY (cr.professional_id IS NOT NULL) DESC,
               (cr.service_id IS NOT NULL) DESC
      LIMIT 1;

      IF v_rate IS NULL THEN
        SELECT commission_rate INTO v_rate
        FROM public.professionals
        WHERE org_id = v_order.org_id AND id = v_item.professional_id;
      END IF;

    ELSIF v_item.item_type = 'product' THEN
      v_enabled := false;
      v_default_rate := NULL;
      SELECT coalesce((setting_value->>'enabled')::boolean, false),
             nullif(setting_value->>'default_rate', '')::numeric
      INTO v_enabled, v_default_rate
      FROM public.app_settings
      WHERE org_id = v_order.org_id
        AND setting_key = 'product_commission'
        AND (branch_id IS NULL OR branch_id IS NOT DISTINCT FROM v_order.branch_id)
      ORDER BY (branch_id IS NOT NULL) DESC
      LIMIT 1;

      IF NOT coalesce(v_enabled, false) THEN CONTINUE; END IF;

      v_rate := NULL;
      SELECT cr.rate INTO v_rate
      FROM public.commission_rules cr
      WHERE cr.org_id = v_order.org_id
        AND cr.active = true
        AND cr.item_type = 'product'
        AND cr.service_id IS NULL
        AND (cr.professional_id = v_item.professional_id OR cr.professional_id IS NULL)
        AND (cr.product_id = v_item.product_id OR cr.product_id IS NULL)
      ORDER BY (cr.professional_id IS NOT NULL) DESC,
               (cr.product_id IS NOT NULL) DESC
      LIMIT 1;

      IF v_rate IS NULL THEN
        SELECT coalesce(v_default_rate, commission_rate) INTO v_rate
        FROM public.professionals
        WHERE org_id = v_order.org_id AND id = v_item.professional_id;
      END IF;
    END IF;

    INSERT INTO public.commissions(
      org_id, branch_id, professional_id, appointment_id,
      service_order_item_id, service_order_payment_id,
      item_type, base_amount, rate, amount, status
    ) VALUES (
      v_order.org_id, v_order.branch_id, v_item.professional_id,
      coalesce(v_item.source_appointment_id, v_order.appointment_id),
      v_item.id, p_payment_id, v_item.item_type, v_base,
      coalesce(v_rate, 0), round(v_base * coalesce(v_rate, 0) / 100, 2), 'pending'
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION private.accrue_partial_service_order_commissions(uuid, uuid, numeric)
  FROM public, anon, authenticated;

-- Não permite que uma Comanda de filial use o caixa da matriz como fallback.
DO $$
DECLARE
  v_definition text;
  v_old text := 'and (branch_id is not distinct from v_order.branch_id or branch_id is null)';
  v_new text := 'and branch_id is not distinct from v_order.branch_id';
BEGIN
  SELECT pg_get_functiondef(
    'public.register_service_order_payment(uuid,numeric,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar o seletor de Caixa esperado em register_service_order_payment.';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);

  -- Grava a unidade também nas comissões geradas no fechamento da Comanda.
  -- A segunda substituição cobre a definição histórica que não listava
  -- service_order_payment_id na comissão de serviço.
  v_definition := replace(
    v_definition,
    'org_id,professional_id,sale_id,appointment_id,service_order_item_id,service_order_payment_id,',
    'org_id,branch_id,professional_id,sale_id,appointment_id,service_order_item_id,service_order_payment_id,'
  );
  v_definition := replace(
    v_definition,
    'org_id,professional_id,sale_id,appointment_id,service_order_item_id,',
    'org_id,branch_id,professional_id,sale_id,appointment_id,service_order_item_id,service_order_payment_id,'
  );
  v_definition := replace(
    v_definition,
    'v_order.org_id,v_item.professional_id,v_sale_id,',
    'v_order.org_id,v_order.branch_id,v_item.professional_id,v_sale_id,'
  );

  IF position('org_id,professional_id,sale_id,appointment_id,service_order_item_id,' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'Não foi possível adicionar branch_id às comissões do fechamento da Comanda.';
  END IF;

  EXECUTE v_definition;
END;
$$;

-- Caixa recebe filial explicitamente. O parâmetro tem default para preservar
-- chamadas administrativas antigas que abrem o caixa da matriz.
DROP FUNCTION IF EXISTS public.open_cash_register(uuid, numeric);

CREATE OR REPLACE FUNCTION public.open_cash_register(
  p_org_id uuid,
  p_opening_amount numeric,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;
  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'Valor inicial inválido.';
  END IF;
  IF NOT private.has_org_role(
    p_org_id, ARRAY['owner','admin','manager','receptionist','finance']
  ) THEN
    RAISE EXCEPTION 'Sem permissão para abrir o Caixa.';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_branch_id AND b.org_id = p_org_id AND b.active = true
  ) THEN
    RAISE EXCEPTION 'Filial inválida ou inativa para esta organização.';
  END IF;

  PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.cash_registers cr
    WHERE cr.org_id = p_org_id
      AND cr.branch_id IS NOT DISTINCT FROM p_branch_id
      AND cr.status = 'open'
  ) THEN
    RAISE EXCEPTION 'Já existe um caixa aberto para esta unidade.';
  END IF;

  INSERT INTO public.cash_registers(
    org_id, branch_id, opening_amount, status, opened_by
  ) VALUES (
    p_org_id, p_branch_id, p_opening_amount, 'open', v_user
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'cash_register_id', v_id,
    'branch_id', p_branch_id,
    'opening_amount', p_opening_amount,
    'status', 'open'
  );
END;
$function$;

-- Paga somente comissões da mesma unidade e exige o caixa exato dessa unidade.
CREATE OR REPLACE FUNCTION public.pay_professional_commissions(
  p_org_id uuid,
  p_professional_id uuid,
  p_commission_ids uuid[],
  p_payment_method text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_branch_id uuid;
  v_register_id uuid;
  v_payout_id uuid;
  v_cash_movement_id uuid;
  v_amount numeric(12,2) := 0;
  v_count integer := 0;
  v_expected integer;
  v_comm record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;
  IF p_commission_ids IS NULL OR cardinality(p_commission_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma comissão.';
  END IF;
  IF cardinality(p_commission_ids) <> (
    SELECT count(DISTINCT item) FROM unnest(p_commission_ids) AS u(item)
  ) THEN
    RAISE EXCEPTION 'A seleção contém comissões repetidas.';
  END IF;
  IF p_payment_method NOT IN ('cash','pix','credit_card','debit_card','transfer','voucher','other') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;
  IF NOT private.has_org_role(p_org_id, ARRAY['owner','admin','manager','finance']) THEN
    RAISE EXCEPTION 'Somente administração ou financeiro pode pagar comissões.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.org_id = p_org_id AND p.id = p_professional_id
  ) THEN
    RAISE EXCEPTION 'Profissional não encontrado.';
  END IF;

  SELECT c.branch_id INTO v_branch_id
  FROM public.commissions c
  WHERE c.org_id = p_org_id
    AND c.professional_id = p_professional_id
    AND c.id = ANY(p_commission_ids)
  ORDER BY c.created_at, c.id
  LIMIT 1;

  SELECT count(*) INTO v_expected FROM unnest(p_commission_ids);

  FOR v_comm IN
    SELECT c.id, c.amount, c.branch_id
    FROM public.commissions c
    WHERE c.org_id = p_org_id
      AND c.professional_id = p_professional_id
      AND c.id = ANY(p_commission_ids)
      AND c.status IN ('pending','approved')
      AND c.payout_id IS NULL
      AND c.branch_id IS NOT DISTINCT FROM v_branch_id
    ORDER BY c.created_at, c.id
    FOR UPDATE
  LOOP
    v_count := v_count + 1;
    v_amount := v_amount + v_comm.amount;
  END LOOP;

  IF v_count <> v_expected THEN
    RAISE EXCEPTION 'As comissões selecionadas devem pertencer ao mesmo profissional e unidade e ainda estar pendentes.';
  END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'O valor total das comissões deve ser maior que zero.'; END IF;

  SELECT cr.id INTO v_register_id
  FROM public.cash_registers cr
  WHERE cr.org_id = p_org_id
    AND cr.status = 'open'
    AND cr.branch_id IS NOT DISTINCT FROM v_branch_id
  ORDER BY cr.opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_register_id IS NULL THEN
    RAISE EXCEPTION 'Abra o Caixa desta unidade antes de pagar comissões.';
  END IF;

  INSERT INTO public.commission_payouts(
    org_id, professional_id, branch_id, cash_register_id,
    amount, payment_method, notes, paid_by
  ) VALUES (
    p_org_id, p_professional_id, v_branch_id, v_register_id,
    v_amount, p_payment_method, nullif(btrim(p_notes),''), v_user
  ) RETURNING id INTO v_payout_id;

  INSERT INTO public.cash_movements(
    org_id, branch_id, cash_register_id, movement_type, category,
    description, amount, payment_method, created_by
  ) VALUES (
    p_org_id, v_branch_id, v_register_id, 'expense', 'professional_commission',
    'Pagamento de comissão ao profissional', v_amount, p_payment_method, v_user
  ) RETURNING id INTO v_cash_movement_id;

  UPDATE public.commission_payouts
  SET cash_movement_id = v_cash_movement_id
  WHERE org_id = p_org_id AND id = v_payout_id;

  FOR v_comm IN
    SELECT c.id, c.amount
    FROM public.commissions c
    WHERE c.org_id = p_org_id
      AND c.professional_id = p_professional_id
      AND c.id = ANY(p_commission_ids)
    ORDER BY c.created_at, c.id
  LOOP
    INSERT INTO public.commission_payout_items(org_id, payout_id, commission_id, amount)
    VALUES (p_org_id, v_payout_id, v_comm.id, v_comm.amount);
  END LOOP;

  UPDATE public.commissions
  SET status = 'paid', paid_at = clock_timestamp(), payout_id = v_payout_id
  WHERE org_id = p_org_id
    AND professional_id = p_professional_id
    AND id = ANY(p_commission_ids)
    AND status IN ('pending','approved')
    AND payout_id IS NULL;

  RETURN jsonb_build_object(
    'payout_id', v_payout_id,
    'cash_movement_id', v_cash_movement_id,
    'professional_id', p_professional_id,
    'branch_id', v_branch_id,
    'amount', v_amount,
    'commission_count', v_count,
    'paid_at', clock_timestamp()
  );
END;
$function$;
