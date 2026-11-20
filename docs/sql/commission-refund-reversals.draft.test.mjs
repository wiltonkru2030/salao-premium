/**
 * Teste estático do rascunho de estorno e compensação de comissões.
 * Responsabilidade: verificar reversão única, cálculo líquido e separação SECURITY DEFINER/INVOKER.
 * Limite: não substitui aplicação em banco descartável, testes financeiros ou concorrência real.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("./commission-refund-reversals.draft.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.equal((sql.match(/as \$function\$/gi)||[]).length,(sql.match(/\$function\$;/gi)||[]).length,
  "Toda função SQL precisa terminar com delimitador e ponto e vírgula.");
assert.match(normalized,/add column if not exists reversal_of_commission_id uuid/);
assert.match(normalized,/create unique index if not exists commissions_reversal_source_unique/);
assert.match(normalized,/drop constraint if exists commission_payout_items_amount_check/);
assert.match(normalized,/reversal_of_commission_id is null/);
assert.match(normalized,/-abs\(coalesce\(v_comm\.amount,0\)\)/);
assert.match(normalized,/amount<0 and c\.reversal_of_commission_id is not null/);
assert.match(normalized,/if v_amount<=0 then raise exception/);
assert.match(normalized,/for update of p/);
assert.match(normalized,/security definer/);
assert.match(normalized,/security invoker/);

const functions=[...sql.matchAll(/create or replace function\s+([a-z0-9_.]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
const names=functions.map(match=>match[1].toLowerCase());
assert.deepEqual(names,[
  "private.refund_service_order","public.refund_service_order",
  "private.pay_professional_commissions","public.pay_professional_commissions"
]);
for(const match of functions) {
  const name=match[1].toLowerCase();
  const header=match[2].toLowerCase();
  if(name.startsWith("private.")) {
    assert.match(header,/security definer/);
    assert.match(header,/set search_path\s+(to|=)\s*''/);
  } else {
    assert.match(header,/security invoker/);
    assert.doesNotMatch(header,/security definer/);
  }
}
console.log("Contrato estático do estorno de comissões: OK (não equivale à aplicação no PostgreSQL).");
