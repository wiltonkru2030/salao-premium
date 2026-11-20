/**
 * Teste estático da migration de auditoria para identidade global.
 * Responsabilidade: verificar auditoria de CRUD, lixeira e identificadores compostos.
 * Limite: não substitui teste real de INSERT/UPDATE/DELETE com papéis distintos.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("./audit-composite-record-identifiers.draft.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.equal((sql.match(/as \$function\$/gi)||[]).length,1);
assert.equal((sql.match(/\$function\$;/gi)||[]).length,1);
assert.match(normalized,/security definer/);
assert.match(normalized,/set search_path = ''/);
assert.match(normalized,/revoke all on function private\.capture_row_audit\(\) from public,anon,authenticated/);
assert.match(normalized,/before_data,after_data/);
assert.match(normalized,/insert into public\.recycle_bin/);
assert.match(normalized,/insert into public\.audit_events/);
assert.match(normalized,/v_data->>'auth_user_id'/);
assert.match(normalized,/v_data->>'customer_id'/);
assert.match(normalized,/v_data->>'branch_id'/);
assert.match(normalized,/v_data->>'coupon_id'/);
for(const table of [
  "customer_profiles","customer_tenant_memberships",
  "customer_account_customers","customer_identity_link_requests"
]) {
  assert.match(normalized,new RegExp("create trigger audit_row_change after insert or update or delete on public\\."+table));
}
console.log("Contrato estático da auditoria global: OK (não equivale à execução no PostgreSQL).");
