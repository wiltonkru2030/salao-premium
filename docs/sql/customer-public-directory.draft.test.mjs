/**
 * Teste estático do rascunho SQL do diretório público.
 * Responsabilidade: conferir isolamento, opt-in, RPCs e privilégios antes de qualquer aplicação.
 * Limite: não substitui parse/execução PostgreSQL nem teste real com anon/authenticated.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("./customer-public-directory.draft.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
assert.match(normalized,/^\s*--\s*rascunho/m);
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.equal((sql.match(/as \$function\$/g)||[]).length,(sql.match(/\$function\$;/g)||[]).length);
assert.doesNotMatch(normalized,/drop\s+table|truncate\s+table/);

for(const table of ["salon_public_profiles","branch_public_profiles"]) {
  assert.match(normalized,new RegExp("create table if not exists public\\."+table+"\\b"));
  assert.match(normalized,new RegExp("alter table public\\."+table+" enable row level security"));
  assert.match(normalized,new RegExp("create trigger audit_row_change after insert or update or delete on public\\."+table));
}
assert.match(normalized,/revoke all on public\.salon_public_profiles,public\.branch_public_profiles from public,anon/);
assert.match(normalized,/where sp\.is_published/);
assert.match(normalized,/and bp\.is_published/);
assert.match(normalized,/private\.is_org_admin\(p_org_id\)/);

const functions=[...sql.matchAll(/create or replace function\s+((?:public|private)\.[a-z0-9_]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
const names=functions.map(match=>match[1].toLowerCase());
assert.equal(names.length,6);
assert.equal(new Set(names).size,names.length);
for(const expected of [
  "private.save_public_salon_profile","public.save_public_salon_profile",
  "private.search_public_salons","public.search_public_salons",
  "private.get_public_salon_catalog","public.get_public_salon_catalog"
]) assert.ok(names.includes(expected),"Função ausente: "+expected);

for(const match of functions) {
  const name=match[1].toLowerCase();
  const header=match[2].toLowerCase();
  if(name.startsWith("private.")) {
    assert.match(header,/security definer/);
    assert.match(header,/set search_path\s*=\s*''/);
  } else {
    assert.match(header,/security invoker/);
    assert.doesNotMatch(header,/security definer/);
  }
}
assert.match(normalized,/grant execute on function public\.search_public_salons[\s\S]*?to anon,authenticated/);
assert.match(normalized,/grant execute on function public\.get_public_salon_catalog[\s\S]*?to anon,authenticated/);
assert.match(normalized,/grant execute on function public\.save_public_salon_profile[\s\S]*?to authenticated/);
assert.match(normalized,/grant usage on schema private to anon,authenticated/);

console.log("Contrato estático do diretório público: OK (não equivale à execução no PostgreSQL).");

/** Confere também as migrations aplicadas, não apenas o rascunho histórico. */
const migrationDirectory = new URL("../../supabase/migrations/", import.meta.url);
const migrationFiles = [
  "20261120064407_public_salon_directory_and_availability.sql",
  "20261120064553_align_public_profiles_with_settings.sql",
  "20261120064639_restrict_private_schema_public_api.sql",
  "20261120064758_allow_members_read_public_profile_settings.sql",
  "20261120070111_coupon_fk_indexes_and_public_profile_policy_cleanup.sql",
  "20261120070234_audit_public_salon_profiles.sql"
];
const appliedSql = (await Promise.all(migrationFiles.map(file =>
  readFile(new URL(file, migrationDirectory), "utf8")
))).join("\n").toLowerCase();

for (const table of ["salon_public_profiles", "branch_public_profiles"]) {
  assert.match(appliedSql, new RegExp("create table public\\." + table + "\\b"));
  assert.match(appliedSql, new RegExp("alter table public\\." + table + " enable row level security"));
}
for (const rpc of ["save_public_salon_profile", "search_public_salons", "get_public_salon_catalog", "get_customer_available_slots"]) {
  assert.match(appliedSql, new RegExp("create or replace function public\\." + rpc + "\\b"));
  assert.match(appliedSql, new RegExp("create or replace function private\\." + rpc + "\\b"));
}
assert.match(appliedSql, /grant usage on schema private to anon, authenticated/);
assert.ok(appliedSql.includes("grant execute on function private.search_public_salons"));
assert.ok(appliedSql.includes("grant execute on function private.get_public_salon_catalog"));
assert.ok(appliedSql.includes("grant execute on function private.get_customer_available_slots"));
assert.ok(!appliedSql.split("\n").some(line =>
  line.includes("grant execute on function private.save_public_salon_profile") && line.includes("to anon")
));
assert.match(appliedSql, /appointment_holds/);
assert.match(appliedSql, /branch_closures/);
assert.match(appliedSql, /professional_time_off/);
assert.match(appliedSql, /create trigger audit_row_change after insert or update or delete on public\\.salon_public_profiles/);
assert.match(appliedSql, /create trigger audit_row_change after insert or update or delete on public\\.branch_public_profiles/);
assert.match(appliedSql, /v_data->>'branch_id'/);
assert.match(appliedSql, /v_data->>'slug'/);
assert.match(appliedSql, /insert into public\\.recycle_bin/);

console.log("Contrato estático do diretório público e migrations: OK (não equivale à execução no PostgreSQL).");
