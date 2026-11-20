-- SALÃO PREMIUM | Proposta de bloqueio de inclusão após pagamento (NÃO APLICADA)
-- Justificativa: alteração do denominador da comissão proporcional após recebimento.
-- Validar em homologação: fluxos de pagamento, descontos, agendamentos e RPCs.
-- BEFORE INSERT: trava a comanda para serializar com register_service_order_payment.
BEGIN;
CREATE OR REPLACE FUNCTION private.prevent_paid_order_item_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $body$
DECLARE v_status text; v_has_payment boolean;
BEGIN
  SELECT o.status INTO v_status FROM public.service_orders o
  WHERE o.id=NEW.order_id AND o.org_id=NEW.org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada.' USING ERRCODE='23503'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.service_order_payments p
    WHERE p.org_id=NEW.org_id AND p.order_id=NEW.order_id AND p.status='confirmed') INTO v_has_payment;
  IF v_status IN ('closed','cancelled') OR v_has_payment THEN
    RAISE EXCEPTION 'Não é permitido adicionar itens após o primeiro pagamento.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $body$;
DROP TRIGGER IF EXISTS service_order_items_prevent_paid_insert ON public.service_order_items;
CREATE TRIGGER service_order_items_prevent_paid_insert
BEFORE INSERT ON public.service_order_items FOR EACH ROW
EXECUTE FUNCTION private.prevent_paid_order_item_insert();
COMMIT;
-- Testar concorrência com duas sessões: pagamento e inserção no mesmo pedido.
