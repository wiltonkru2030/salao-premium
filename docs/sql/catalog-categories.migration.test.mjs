/**
 * Teste estático da migration de categorias do catálogo.
 * Responsabilidade: conferir isolamento por tenant, auditoria e contratos das RPCs.
 * Limite: não substitui execução SQL em projeto Supabase de teste.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const sql=await readFile(new URL("../../supabase/migrations/20261120074000_catalog_categories.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.match(normalized,/create table if not exists public\.catalog_categories/);
assert.match(normalized,/alter table public\.catalog_categories enable row level security/);
assert.match(normalized,/grant select on public\.catalog_categories to authenticated/);
assert.match(normalized,/revoke all on public\.catalog_categories from public,anon/);
assert.doesNotMatch(normalized,/grant (insert|update|delete) on public\.catalog_categories to authenticated/);
assert.match(normalized,/create policy catalog_categories_select_org_members/);
assert.match(normalized,/private\.has_org_role\(org_id/);
assert.match(normalized,/create trigger audit_row_change after insert or update or delete on public\.catalog_categories/);
assert.match(normalized,/catalog_categories_org_type_name_unique/);
assert.match(normalized,/from public\.services/);
assert.match(normalized,/from public\.products/);
assert.match(normalized,/update public\.services set category=v_name/);
assert.match(normalized,/update public\.products set category=v_name/);
assert.match(normalized,/set active=p_active/);
assert.match(normalized,/private\.is_org_admin\(p_org_id\)/);
assert.match(normalized,/p_category_type is null/);
assert.match(normalized,/on conflict do nothing/);
assert.equal((sql.match(/as \$function\$/gi)||[]).length,4);
assert.equal((sql.match(/\$function\$;/gi)||[]).length,4);
const functions=[...sql.matchAll(/create or replace function\s+((?:public|private)\.[a-z0-9_]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
assert.equal(functions.length,4);
for(const fn of functions){
  if(fn[1].toLowerCase().startsWith("private.")){
    assert.match(fn[2].toLowerCase(),/security definer/);
    assert.match(fn[2].toLowerCase(),/set search_path\s*=\s*''/);
  }else{
    assert.match(fn[2].toLowerCase(),/security invoker/);
    assert.doesNotMatch(fn[2].toLowerCase(),/security definer/);
  }
}
assert.doesNotMatch(normalized,/grant execute on function public\.[a-z0-9_]+\([^;]+to anon/);
console.log("Contrato estático da migration de categorias: OK.");
