/**
 * Contratos estáticos da migration de catálogo de serviços por filial.
 * Não substitui execução SQL e testes de RLS em projeto Supabase de QA.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const sql=await readFile(new URL("../../supabase/migrations/20261120110000_branch_scoped_service_catalog.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/^\s*--/);
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.match(normalized,/add column if not exists branch_id uuid/);
assert.match(normalized,/foreign key\(org_id,branch_id\) references public\.branches\(org_id,id\)/);
assert.match(normalized,/services_org_branch_active_name_idx/);
assert.match(normalized,/drop policy if exists services_select_professional_app/);
assert.match(normalized,/drop policy if exists branches_select_staff/);
assert.match(normalized,/p\.branch_id=branches\.id/);
assert.match(normalized,/private\.has_org_role\(org_id,array\['owner','admin','manager','receptionist'\]\)/);
assert.match(normalized,/private\.professional_app_scope\(org_id\)='self'/);
assert.match(normalized,/ps\.professional_id=private\.current_professional_id\(services\.org_id\)/);
assert.match(normalized,/services\.branch_id is null or services\.branch_id=p\.branch_id/);
assert.match(normalized,/private\.professional_app_scope\(org_id\) in \('calendar_all','all'\)/);
assert.match(normalized,/comment on column public\.services\.branch_id/);
assert.match(normalized,/drop policy if exists products_select_admin_or_full_app/);
assert.match(normalized,/products\.branch_id is null or products\.branch_id=p\.branch_id/);
assert.doesNotMatch(normalized,/drop\s+table|truncate\s+table/);
console.log("Contrato estático do catálogo por filial: OK.");
