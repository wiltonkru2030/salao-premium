-- SALÃO PREMIUM | Revisão de privilégios financeiros e de comandas
-- PROPOSTA NÃO APLICADA AO BANCO. Executar somente após aprovação e validação de dependências.
-- Revoga operações de DDL/estrutura perigosas que NÃO são protegidas por RLS.
-- Preserva SELECT/INSERT/UPDATE/DELETE existentes, cujas políticas RLS devem ser auditadas separadamente.
BEGIN;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
 public.commissions,
 public.commission_payouts,
 public.service_orders,
 public.service_order_items
FROM anon, authenticated;
-- Verificação: deve retornar zero linhas para os privilégios revogados.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND table_name IN ('commissions','commission_payouts','service_orders','service_order_items')
    AND grantee IN ('anon','authenticated')
    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
 ) THEN RAISE EXCEPTION 'Permissões perigosas ainda presentes'; END IF;
END $$;
COMMIT;
