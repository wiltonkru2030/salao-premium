-- SALÃO PREMIUM | Remediação global de privilégios PostgreSQL (NÃO EXECUTADA)
-- Escopo: tabelas existentes em public. Não remove dados e não altera RLS ou permissões DML.
-- Atenção: verificar integrações que utilizem diretamente REFERENCES ou TRIGGER antes de aplicar.
-- Executar somente após autorização, backup e janela de manutenção.
BEGIN;
DO $audit$
DECLARE item record;
BEGIN
 FOR item IN
  SELECT format('%I.%I',n.nspname,c.relname) AS qualified
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
 LOOP
  EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM anon, authenticated',item.qualified);
 END LOOP;
END $audit$;
DO $verify$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
   AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
    OR has_table_privilege('anon',c.oid,'TRIGGER') OR has_table_privilege('authenticated',c.oid,'TRIGGER')
    OR has_table_privilege('anon',c.oid,'REFERENCES') OR has_table_privilege('authenticated',c.oid,'REFERENCES'))
 ) THEN RAISE EXCEPTION 'Ainda existem privilégios perigosos: transação revertida'; END IF;
END $verify$;
COMMIT;
-- Após aprovação: reexecutar auditoria e Supabase Security Advisor.
