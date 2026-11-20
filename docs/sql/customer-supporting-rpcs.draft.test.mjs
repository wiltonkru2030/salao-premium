/**
 * Testes estáticos dos RPCs auxiliares da Área da Cliente.
 * Responsabilidade: verificar identidade própria, publicação opt-in, disponibilidade e RLS.
 * Limite: não substitui execução SQL nem teste real com contas e papéis diferentes.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(name) {
  return readFile(new URL("./"+name,import.meta.url),"utf8");
}
function checkDelimiters(sql,label) {
  assert.equal((sql.match(/as \$function\$/gi)||[]).length,(sql.match(/\$function\$;/gi)||[]).length,
    label+": delimitadores de função incompletos.");
  assert.match(sql,/\bbegin\s*;/i);
  assert.match(sql,/\bcommit\s*;\s*$/i);
}
function checkFunctionSecurity(sql,expected) {
  const functions=[...sql.matchAll(/create or replace function\s+((?:public|private)\.[a-z0-9_]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
  assert.equal(functions.length,expected);
  for(const fn of functions) {
    const name=fn[1].toLowerCase(),header=fn[2].toLowerCase();
    if(name.startsWith("private.")) {
      assert.match(header,/security definer/);
      assert.match(header,/set search_path\s*=\s*''/);
    } else {
      assert.match(header,/security invoker/);
      assert.doesNotMatch(header,/security definer/);
    }
  }
  return functions.map(fn=>fn[1].toLowerCase());
}

async function run() {
  const history=await read("customer-appointment-history.draft.sql");
  checkDelimiters(history,"Histórico");
  const historyFunctions=checkFunctionSecurity(history,2);
  assert.deepEqual(historyFunctions,[
    "private.get_my_customer_appointments","public.get_my_customer_appointments"
  ]);
  assert.match(history,/link\.auth_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(history,/membership\.status\s*=\s*'active'/i);
  assert.doesNotMatch(history,/p_customer_id/i);

  const historyMigration=await readFile(
    new URL("../../supabase/migrations/20261120163051_customer_appointment_history.sql",import.meta.url),"utf8"
  );
  checkDelimiters(historyMigration,"Migration de histórico");
  const migratedHistoryFunctions=checkFunctionSecurity(historyMigration,2);
  assert.deepEqual(migratedHistoryFunctions,[
    "private.get_my_customer_appointments","public.get_my_customer_appointments"
  ]);
  assert.match(historyMigration,/membership\.status\s*=\s*'active'/i);
  assert.match(historyMigration,/revoke all on function private\.get_my_customer_appointments\(\) from public, anon, authenticated/i);

  const availability=await read("customer-availability-slots.draft.sql");
  checkDelimiters(availability,"Disponibilidade");
  const availabilityFunctions=checkFunctionSecurity(availability,2);
  assert.deepEqual(availabilityFunctions,[
    "private.get_customer_available_slots","public.get_customer_available_slots"
  ]);
  for(const required of [
    "salon_public_profiles","branch_public_profiles","branch_business_hours",
    "professional_working_hours","appointment_blocks","branch_closures",
    "professional_time_off","appointment_holds"
  ]) assert.ok(availability.includes(required),"Tabela de validação ausente: "+required);
  assert.match(availability,/sp\.is_published/);
  assert.match(availability,/bp\.is_published/);
  assert.match(availability,/hold\.status\s*=\s*'active'/i);
  assert.match(availability,/a\.status not in \('cancelled','no_show'\)/i);

  const engagement=await read("customer-engagement.draft.sql");
  checkDelimiters(engagement,"Engajamento");
  const engagementFunctions=checkFunctionSecurity(engagement,8);
  assert.ok(engagementFunctions.includes("private.notify_customer_appointment_changes"));
  assert.match(engagement,/revoke all on function private\.notify_customer_appointment_changes\(\) from public,anon,authenticated/i);
  assert.match(engagement,/membership\.status='active'/i);
  for(const table of ["customer_favorites","customer_notifications"]) {
    assert.match(engagement,new RegExp("alter table public\\."+table+" enable row level security","i"));
    assert.match(engagement,new RegExp("create trigger audit_row_change after insert or update or delete on public\\."+table,"i"));
  }
  assert.match(engagement,/auth_user_id=\(select auth\.uid\(\)\)/i);
  assert.match(engagement,/grant update\(read_at\) on public\.customer_notifications to authenticated/i);

  const engagementMigration=await readFile(
    new URL("../../supabase/migrations/20261120163536_customer_favorites_and_preferences.sql",import.meta.url),"utf8"
  );
  const migratedEngagementFunctions=checkFunctionSecurity(engagementMigration,7);
  assert.ok(migratedEngagementFunctions.includes("private.is_public_salon"));
  assert.ok(migratedEngagementFunctions.includes("public.update_my_customer_preferences"));
  assert.match(engagementMigration,/alter table public\.customer_favorites enable row level security/i);
  assert.match(engagementMigration,/revoke all on public\.customer_favorites from public,anon,authenticated/i);
  assert.doesNotMatch(engagementMigration,/create trigger audit_row_change/i);
  assert.doesNotMatch(engagementMigration,/create table if not exists public\.customer_notifications/i);

  console.log("Contratos estáticos dos RPCs auxiliares da cliente: OK (não equivalem à execução PostgreSQL).");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
