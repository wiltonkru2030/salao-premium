/**
 * Teste estático da migration de snapshot das comissões.
 * Responsabilidade: garantir que a regra seja congelada no primeiro recebimento de cada item.
 * Limite: não substitui aplicação em banco descartável nem teste concorrente de pagamentos.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath=new URL("./legacy-unapplied/20261119170000_snapshot_commission_rate_on_first_payment.sql",import.meta.url);
const sql=await readFile(migrationPath,"utf8");
const normalized=sql.toLowerCase();

assert.match(normalized,/add column if not exists commission_rate_snapshot/);
assert.match(normalized,/add column if not exists commission_enabled_snapshot/);
assert.match(normalized,/commission_enabled_snapshot is null/);
assert.match(normalized,/after insert on public\.service_order_payments/);
assert.match(normalized,/before insert on public\.commissions/);
assert.match(normalized,/new\.rate := coalesce\(v_snapshot\.commission_rate_snapshot, 0\)/);
assert.match(normalized,/new\.amount := round\(coalesce\(new\.base_amount, 0\) \* new\.rate \/ 100, 2\)/);
assert.match(normalized,/if not v_snapshot\.commission_enabled_snapshot then\s+return null/);
assert.match(normalized,/set search_path = ''/);
assert.match(normalized,/revoke all on function private\.snapshot_service_order_item_commissions\(\) from public, anon, authenticated/);
assert.match(normalized,/revoke all on function private\.enforce_commission_item_snapshot\(\) from public, anon, authenticated/);

const names=[...normalized.matchAll(/create or replace function\s+([a-z0-9_.]+)/g)].map(match=>match[1]);
assert.deepEqual(names,[
  "private.snapshot_service_order_item_commissions",
  "private.enforce_commission_item_snapshot"
]);
assert.doesNotMatch(normalized,/create or replace function public\./);

console.log("Contrato estático da migration de snapshot de comissões: OK (não equivale à aplicação no banco).");
