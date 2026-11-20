/**
 * Contratos estáticos da criação transacional de profissionais.
 * Não substitui execução SQL em projeto Supabase de QA.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const sql=await readFile(new URL("../../supabase/migrations/20261120100000_professional_transactional_creation.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/^\s*--/);
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.match(normalized,/create or replace function private\.create_professional_with_services/);
assert.match(normalized,/create or replace function public\.create_professional_with_services/);
assert.match(normalized,/security definer[\s\S]*?set search_path\s*=\s*''/);
assert.match(normalized,/security invoker[\s\S]*?private\.create_professional_with_services/);
assert.match(normalized,/private\.is_org_admin\(p_org_id\)/);
assert.match(normalized,/p_branch_id is not null/);
assert.match(normalized,/b\.org_id=p_org_id and b\.id=p_branch_id and b\.active=true/);
assert.match(normalized,/p_tax_regime is null or p_tax_regime not in \('individual','mei'\)/);
assert.match(normalized,/p_service_ids is null or cardinality\(p_service_ids\)=0/);
assert.match(normalized,/count\(distinct service_id\)/);
assert.match(normalized,/s\.org_id=p_org_id and s\.id=any\(p_service_ids\) and s\.active=true/);
assert.match(normalized,/p_branch_id is null or s\.branch_id is null or s\.branch_id=p_branch_id/);
assert.match(normalized,/insert into public\.professionals/);
assert.match(normalized,/insert into public\.professional_services/);
assert.match(normalized,/revoke all on function private\.create_professional_with_services/);
assert.match(normalized,/grant execute on function private\.create_professional_with_services[\s\S]*?to authenticated/);
assert.match(normalized,/grant execute on function public\.create_professional_with_services[\s\S]*?to authenticated/);
assert.match(normalized,/comment on function private\.create_professional_with_services/);
assert.match(normalized,/comment on function public\.create_professional_with_services/);
assert.doesNotMatch(normalized,/grant execute on function public\.create_professional_with_services[^;]*to anon/);
assert.doesNotMatch(normalized,/drop\s+table|truncate\s+table/);
console.log("Contrato estático da criação transacional de profissionais: OK.");
