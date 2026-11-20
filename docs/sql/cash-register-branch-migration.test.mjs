/**
 * Contratos estáticos da abertura e conferência de caixa por unidade.
 * Não substitui testes autenticados de concorrência e fluxo financeiro real.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261120073222_complete_branch_cash_register_and_cash_summary.sql", import.meta.url), "utf8");
const sql = migration.toLowerCase();

assert.match(sql, /^\s*--/);
assert.match(sql, /\bbegin\s*;/);
assert.match(sql, /\bcommit\s*;\s*$/);
assert.match(sql, /create or replace function private\.open_cash_register_for_branch\s*\(\s*p_org_id uuid,\s*p_branch_id uuid,\s*p_opening_amount numeric/s);
assert.match(sql, /from public\.branches[\s\S]*?org_id\s*=\s*p_org_id[\s\S]*?id\s*=\s*p_branch_id[\s\S]*?active\s*=\s*true[\s\S]*?for update/);
assert.match(sql, /private\.open_cash_register\(p_org_id,p_opening_amount\)/);
assert.match(sql, /create function public\.open_cash_register_for_branch[\s\S]*?security invoker[\s\S]*?private\.open_cash_register_for_branch/s);
assert.match(sql, /create function private\.get_cash_register_summary[\s\S]*?security definer/s);
assert.match(sql, /create function public\.get_cash_register_summary[\s\S]*?security invoker[\s\S]*?private\.get_cash_register_summary/s);
assert.match(sql, /grant execute on function public\.open_cash_register_for_branch\(uuid,uuid,numeric\) to authenticated, service_role/);
assert.match(sql, /grant execute on function public\.get_cash_register_summary\(uuid\) to authenticated, service_role/);
assert.match(sql, /revoke all on function public\.open_cash_register_for_branch\(uuid,uuid,numeric\) from public,anon/);
assert.match(sql, /revoke all on function public\.get_cash_register_summary\(uuid\) from public,anon/);
assert.match(sql, /movement_type\s*=\s*'income'\s+and\s+payment_method\s*=\s*'cash'/);
assert.match(sql, /movement_type\s*=\s*'expense'\s+and\s+payment_method\s*=\s*'cash'/);
assert.doesNotMatch(sql, /drop\s+table|truncate\s+table/);

console.log("Contratos estáticos do Caixa por filial e dinheiro físico: OK (E2E ainda necessário).");
