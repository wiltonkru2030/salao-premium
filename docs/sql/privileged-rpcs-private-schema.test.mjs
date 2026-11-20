/**
 * Teste estático do hardening de RPCs privilegiadas.
 * Confere migração de implementações para private e wrappers públicos INVOKER.
 * Não substitui testes autenticados nem validação transacional no PostgreSQL.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261120072000_move_privileged_financial_and_workflow_rpcs_private.sql", import.meta.url), "utf8");
const sql = migration.toLowerCase();

assert.match(sql, /^\s*--/);
assert.match(sql, /\bbegin\s*;/);
assert.match(sql, /\bcommit\s*;\s*$/);
assert.doesNotMatch(sql, /drop\s+table|truncate\s+table/);

const routines = [
  ["adjust_product_stock", "uuid,text,numeric,text,numeric", "jsonb"],
  ["cancel_expense", "uuid", "jsonb"],
  ["cancel_service_order", "uuid,boolean", "jsonb"],
  ["close_cash_register", "uuid,numeric", "jsonb"],
  ["open_cash_register", "uuid,numeric", "jsonb"],
  ["pay_expense", "uuid,text,boolean", "jsonb"],
  ["pay_professional_commissions", "uuid,uuid,uuid[],text,text", "jsonb"],
  ["permanently_delete_recycle_bin_group", "uuid", "integer"],
  ["refund_service_order", "uuid,boolean,text", "jsonb"],
  ["register_cash_movement", "uuid,text,numeric,text,text,text", "jsonb"],
  ["register_service_order_payment", "uuid,numeric,text", "jsonb"],
  ["restore_recycle_bin_group", "uuid", "integer"],
  ["revoke_professional_app_access", "uuid,uuid", "jsonb"],
  ["set_professional_app_access", "uuid,uuid,boolean,text", "jsonb"],
  ["start_appointment_group_service_order", "uuid,uuid,boolean", "jsonb"],
  ["start_appointment_service_order", "uuid,uuid,boolean", "jsonb"]
];

for (const [name, signature, returnType] of routines) {
  assert.match(sql, new RegExp("alter function public\\." + name + "\\(" + signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\) set schema private"));
  const wrapper = new RegExp("create function public\\." + name + "\\([\\s\\S]*?\\)\\s*returns " + returnType + "[\\s\\S]*?security invoker[\\s\\S]*?as \\$\\$ select private\\." + name + "\\(", "i");
  assert.match(migration, wrapper, name + " precisa manter wrapper público INVOKER.");
  assert.match(sql, new RegExp("revoke all on function public\\." + name + "\\(" + signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\) from public, anon"));
  assert.match(sql, new RegExp("grant execute on function public\\." + name + "\\(" + signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\) to authenticated, service_role"));
  assert.match(sql, new RegExp("grant execute on function private\\." + name + "\\(" + signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\) to authenticated, service_role"));
}

assert.match(sql, /grant usage on schema private to authenticated, service_role/);
console.log("Hardening estático das RPCs privilegiadas: OK (não substitui E2E).");
