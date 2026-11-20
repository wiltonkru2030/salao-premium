/**
 * Teste estático da migração de hardening das RPCs.
 * Responsabilidade: verificar que as implementações saem do schema exposto e wrappers ficam INVOKER.
 * Limite: não substitui teste de permissões por papel nem execução em banco descartável.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("./security-definer-api-hardening.draft.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.match(normalized,/grant usage on schema private to authenticated,service_role/);

const names=[...normalized.matchAll(/alter function public\.([a-z0-9_]+)\(/g)].map(match=>match[1]);
assert.equal(names.length,14);
assert.equal(new Set(names).size,names.length);
for(const name of names) {
  assert.match(normalized,new RegExp("create or replace function public\\."+name+"\\("));
  assert.match(normalized,new RegExp("revoke all on function private\\."+name+"\\("));
  assert.match(normalized,new RegExp("grant execute on function private\\."+name+"\\([^;]+ to authenticated,service_role"));
  assert.match(normalized,new RegExp("revoke all on function public\\."+name+"\\("));
  assert.match(normalized,new RegExp("grant execute on function public\\."+name+"\\([^;]+ to authenticated,service_role"));
}
const wrappers=[...sql.matchAll(/create or replace function public\.([a-z0-9_]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
assert.equal(wrappers.length,14);
for(const wrapper of wrappers) {
  assert.match(wrapper[2].toLowerCase(),/security invoker/);
  assert.doesNotMatch(wrapper[2].toLowerCase(),/security definer/);
  assert.match(wrapper[3],new RegExp("select private\\."+wrapper[1]+"\\("));
}
assert.ok(names.includes("register_service_order_payment"));
assert.ok(names.includes("cancel_service_order"));
assert.ok(!names.includes("refund_service_order"),"Estorno de comissões é tratado em rascunho separado.");
assert.ok(!names.includes("pay_professional_commissions"),"Repasse de comissões é tratado em rascunho separado.");

console.log("Contrato estático de hardening das RPCs: OK (não equivale à aplicação no PostgreSQL).");
