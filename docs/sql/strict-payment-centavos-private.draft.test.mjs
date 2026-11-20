/**
 * Verifica o contrato estático da correção monetária da RPC privada.
 * Não executa a função no PostgreSQL nem cria registros financeiros.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("./strict-payment-centavos-private.draft.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/create or replace function private\.register_service_order_payment/);
assert.match(normalized,/security definer/);
assert.match(normalized,/p_amount <> round\(p_amount,2\)/);
assert.match(normalized,/p_amount::text in \('nan','infinity','-infinity'\)/);
assert.match(normalized,/p_payment_method is null or p_payment_method not in/);
assert.match(normalized,/v_paid \+ p_amount > v_order\.total then/);
assert.match(normalized,/if v_paid = v_order\.total then/);
assert.doesNotMatch(normalized,/v_order\.total \+ 0\.01|v_paid \+ 0\.01/);
assert.match(normalized,/select \* into v_order from public\.service_orders where id = p_order_id for update/);
assert.match(normalized,/branch_id is not distinct from v_order\.branch_id or branch_id is null/);
assert.match(normalized,/limit 1 for update/);
assert.match(normalized,/private\.accrue_partial_service_order_commissions/);
assert.match(normalized,/insert into public\.cash_movements/);
assert.match(normalized,/insert into public\.sale_items/);
assert.doesNotMatch(normalized,/create or replace function public\./);
console.log("Contrato estático de pagamento exato: OK (sem E2E).");
