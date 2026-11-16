-- 20261116060000_branch_scoped_service_catalog
-- Serviços compartilhados continuam com branch_id NULL.
-- Cada unidade pode criar seus próprios serviços e regras sem alterar o catálogo
-- das demais unidades. Esta migration não deve ser aplicada diretamente em produção.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS branch_id uuid
  REFERENCES public.branches(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS services_org_branch_active_name_idx
  ON public.services(org_id, branch_id, active, name);

ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS branch_id uuid
  REFERENCES public.branches(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS commission_rules_org_branch_service_idx
  ON public.commission_rules(org_id, branch_id, item_type, service_id, professional_id)
  WHERE active = true;

-- Serviços de filial só podem ser consultados/alterados por membros atribuídos
-- àquela filial. O catálogo compartilhado permanece visível conforme as
-- políticas de papel já existentes.
DROP POLICY IF EXISTS branch_access_guard ON public.services;
CREATE POLICY branch_access_guard
  ON public.services AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    branch_id IS NULL
    OR private.has_branch_access(org_id, branch_id)
  )
  WITH CHECK (
    branch_id IS NULL
    OR private.has_branch_access(org_id, branch_id)
  );

DROP POLICY IF EXISTS branch_access_guard ON public.commission_rules;
CREATE POLICY branch_access_guard
  ON public.commission_rules AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    branch_id IS NULL
    OR private.has_branch_access(org_id, branch_id)
  )
  WITH CHECK (
    branch_id IS NULL
    OR private.has_branch_access(org_id, branch_id)
  );

-- Não permite regras de comissão que misturem serviço/profissional de unidades
-- diferentes. Regras de filial podem usar serviços compartilhados ou locais.
CREATE OR REPLACE FUNCTION private.validate_commission_rule_branch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_service_branch uuid;
  v_professional_branch uuid;
BEGIN
  IF NEW.item_type = 'service' AND NEW.service_id IS NOT NULL THEN
    SELECT s.branch_id INTO v_service_branch
    FROM public.services s
    WHERE s.org_id = NEW.org_id AND s.id = NEW.service_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Serviço da regra de comissão não encontrado nesta organização.';
    END IF;

    IF v_service_branch IS NOT NULL
       AND v_service_branch IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'A regra de comissão deve pertencer à mesma unidade do serviço.';
    END IF;
  END IF;

  IF NEW.item_type = 'product' AND NEW.product_id IS NOT NULL THEN
    SELECT p.branch_id INTO v_service_branch
    FROM public.products p
    WHERE p.org_id = NEW.org_id AND p.id = NEW.product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto da regra de comissão não encontrado nesta organização.';
    END IF;

    IF v_service_branch IS NOT NULL
       AND v_service_branch IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'A regra de comissão deve pertencer à mesma unidade do produto.';
    END IF;
  END IF;

  IF NEW.professional_id IS NOT NULL THEN
    SELECT p.branch_id INTO v_professional_branch
    FROM public.professionals p
    WHERE p.org_id = NEW.org_id AND p.id = NEW.professional_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profissional da regra de comissão não encontrado nesta organização.';
    END IF;

    IF NEW.branch_id IS NOT NULL
       AND v_professional_branch IS NOT NULL
       AND v_professional_branch IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'O profissional não pertence à unidade da regra de comissão.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS commission_rule_branch_validate ON public.commission_rules;
CREATE TRIGGER commission_rule_branch_validate
  BEFORE INSERT OR UPDATE OF org_id, branch_id, professional_id, service_id, product_id, item_type
  ON public.commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_commission_rule_branch();

-- Garante que um serviço específico de filial não seja usado em agendamento,
-- orçamento, comanda ou vínculo profissional de outra unidade.
CREATE OR REPLACE FUNCTION private.validate_service_branch_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_service_branch uuid;
  v_parent_branch uuid;
  v_professional_branch uuid;
BEGIN
  IF TG_TABLE_NAME = 'professional_services' THEN
    SELECT s.branch_id INTO v_service_branch
    FROM public.services s
    WHERE s.org_id = NEW.org_id AND s.id = NEW.service_id;

    IF NOT FOUND THEN RETURN NEW; END IF;

    SELECT p.branch_id INTO v_professional_branch
    FROM public.professionals p
    WHERE p.org_id = NEW.org_id AND p.id = NEW.professional_id;

    IF NOT FOUND THEN RETURN NEW; END IF;

    IF v_service_branch IS NOT NULL
       AND v_professional_branch IS NOT NULL
       AND v_service_branch IS DISTINCT FROM v_professional_branch THEN
      RAISE EXCEPTION 'O serviço e o profissional pertencem a unidades diferentes.';
    END IF;

    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    v_parent_branch := NEW.branch_id;
  ELSIF TG_TABLE_NAME = 'quote_items' THEN
    SELECT q.branch_id INTO v_parent_branch
    FROM public.quotes q
    WHERE q.org_id = NEW.org_id AND q.id = NEW.quote_id;
  ELSIF TG_TABLE_NAME = 'service_order_items' THEN
    SELECT so.branch_id INTO v_parent_branch
    FROM public.service_orders so
    WHERE so.org_id = NEW.org_id AND so.id = NEW.order_id;
  ELSIF TG_TABLE_NAME = 'appointment_group_items' THEN
    SELECT ag.branch_id INTO v_parent_branch
    FROM public.appointment_groups ag
    WHERE ag.org_id = NEW.org_id AND ag.id = NEW.appointment_group_id;
  ELSE
    RAISE EXCEPTION 'Tabela não suportada na validação de unidade do serviço.';
  END IF;

  IF NEW.service_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.branch_id INTO v_service_branch
  FROM public.services s
  WHERE s.org_id = NEW.org_id AND s.id = NEW.service_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_service_branch IS NOT NULL
     AND v_service_branch IS DISTINCT FROM v_parent_branch THEN
    RAISE EXCEPTION 'O serviço selecionado não pertence à unidade deste registro.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS service_branch_validate_appointments ON public.appointments;
CREATE TRIGGER service_branch_validate_appointments
  BEFORE INSERT OR UPDATE OF org_id, branch_id, service_id
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.validate_service_branch_reference();

DROP TRIGGER IF EXISTS service_branch_validate_quote_items ON public.quote_items;
CREATE TRIGGER service_branch_validate_quote_items
  BEFORE INSERT OR UPDATE OF org_id, quote_id, service_id
  ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION private.validate_service_branch_reference();

DROP TRIGGER IF EXISTS service_branch_validate_order_items ON public.service_order_items;
CREATE TRIGGER service_branch_validate_order_items
  BEFORE INSERT OR UPDATE OF org_id, order_id, service_id
  ON public.service_order_items
  FOR EACH ROW EXECUTE FUNCTION private.validate_service_branch_reference();

DROP TRIGGER IF EXISTS service_branch_validate_appointment_group_items ON public.appointment_group_items;
CREATE TRIGGER service_branch_validate_appointment_group_items
  BEFORE INSERT OR UPDATE OF org_id, appointment_group_id, service_id
  ON public.appointment_group_items
  FOR EACH ROW EXECUTE FUNCTION private.validate_service_branch_reference();

DROP TRIGGER IF EXISTS service_branch_validate_professional_services ON public.professional_services;
CREATE TRIGGER service_branch_validate_professional_services
  BEFORE INSERT OR UPDATE OF org_id, professional_id, service_id
  ON public.professional_services
  FOR EACH ROW EXECUTE FUNCTION private.validate_service_branch_reference();

-- A regra específica da filial prevalece sobre a regra compartilhada. O mesmo
-- critério vale para serviços e produtos, inclusive pagamentos parciais.
DO $$
DECLARE
  v_definition text;
  v_old text := 'and (cr.professional_id = v_item.professional_id or cr.professional_id is null)';
  v_new text := 'and (cr.professional_id = v_item.professional_id or cr.professional_id is null)' ||
                ' and (cr.branch_id is null or cr.branch_id is not distinct from v_order.branch_id)';
  v_old_order text := '(cr.professional_id is not null) desc,';
  v_new_order text := '(cr.branch_id is not null) desc, (cr.professional_id is not null) desc,';
  v_old_order_upper text := '(cr.professional_id IS NOT NULL) DESC,';
  v_new_order_upper text := '(cr.branch_id IS NOT NULL) DESC, (cr.professional_id IS NOT NULL) DESC,';
BEGIN
  SELECT pg_get_functiondef(
    'private.accrue_partial_service_order_commissions(uuid,uuid,numeric)'::regprocedure
  ) INTO v_definition;

  IF position('cr.branch_id is not distinct from v_order.branch_id' IN v_definition) = 0 THEN
    IF position(v_old IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Não foi possível localizar o filtro de profissional na função de comissão parcial.';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);
    v_definition := replace(v_definition, v_old_order, v_new_order);
    v_definition := replace(v_definition, v_old_order_upper, v_new_order_upper);
    EXECUTE v_definition;
  END IF;

  SELECT pg_get_functiondef(
    'public.register_service_order_payment(uuid,numeric,text)'::regprocedure
  ) INTO v_definition;

  IF position('cr.branch_id is not distinct from v_order.branch_id' IN v_definition) = 0 THEN
    IF position(v_old IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Não foi possível localizar o filtro de profissional na função de fechamento da Comanda.';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);
    v_definition := replace(v_definition, v_old_order, v_new_order);
    EXECUTE v_definition;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_commission_rule_branch() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.validate_service_branch_reference() FROM PUBLIC, anon;

COMMENT ON COLUMN public.services.branch_id IS
  'NULL representa serviço compartilhado pela organização; UUID identifica serviço exclusivo da unidade.';
COMMENT ON COLUMN public.commission_rules.branch_id IS
  'NULL representa regra compartilhada; UUID identifica regra específica da unidade.';
