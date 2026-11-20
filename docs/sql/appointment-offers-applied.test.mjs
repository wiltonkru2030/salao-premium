/** Contratos estáticos da lista de espera, combos e fidelidade já versionados.
 * Não substitui RLS com usuários distintos, reservas concorrentes nem teste de navegador.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
async function sql(name){return (await readFile(new URL("../../supabase/migrations/"+name,import.meta.url),"utf8")).toLowerCase();}
const tables=await sql("20261120212042_service_packages_and_appointment_waitlist.sql");
const slots=await sql("20261120212247_fix_customer_available_slots_date_arithmetic.sql");
const rpcs=await sql("20261120212306_service_packages_waitlist_secure_rpcs.sql");
const booking=await sql("20261120212554_atomic_waitlist_booking_and_cancel_release.sql");
const loyalty=await sql("20261120213452_private_customer_loyalty_overview.sql");
const overnight=await sql("20261120213713_waitlist_avoid_cross_midnight_openings.sql");
for(const name of ["service_packages","service_package_items","appointment_waitlist"]){
 assert.match(tables,new RegExp("create table public\\."+name+"\\s*\\("));
 assert.match(tables,new RegExp("alter table public\\."+name+" enable row level security"));
}
assert.match(tables,/appointment_waitlist_active_unique/);
assert.match(tables,/appointment_waitlist_booking_fk/);
assert.equal((tables.match(/create trigger audit_row_change/g)||[]).length,3);
assert.match(tables,/grant select on public\.service_packages,public\.service_package_items,public\.appointment_waitlist to authenticated/);
assert.doesNotMatch(tables,/grant (insert|update|delete|all) on public\.appointment_waitlist to authenticated/);
assert.match(slots,/generated\.local_start::timestamp as local_start/);
assert.doesNotMatch(slots,/p_date\+generated\.local_start/);
for(const name of ["save_service_package","set_service_package_active","add_appointment_waitlist",
 "set_appointment_waitlist_status","list_appointment_waitlist","find_appointment_waitlist_openings"]){
 assert.match(rpcs,new RegExp("create or replace function private\\."+name+"\\s*\\("));
 assert.match(rpcs,new RegExp("create or replace function public\\."+name+"\\s*\\("));
}
assert.match(rpcs,/not coalesce\(private\.has_org_role/);
assert.match(rpcs,/service_package_items\(org_id,package_id,service_id/);
assert.match(rpcs,/w\.status in \('waiting','contacted'\)/);
assert.match(booking,/create or replace function private\.book_appointment_from_waitlist/);
assert.match(booking,/create or replace function public\.book_appointment_from_waitlist/);
assert.match(booking,/for update/);
assert.match(booking,/from private\.get_customer_available_slots/);
assert.match(booking,/matched_appointment_id=v_appointment_id/);
assert.match(booking,/create trigger release_cancelled_waitlist_appointment/);
assert.match(loyalty,/where link\.auth_user_id=\(select auth\.uid\(\)\)/);
assert.match(loyalty,/membership\.status='active'/);
assert.match(loyalty,/security invoker/);
assert.match(loyalty,/revoke all on function public\.get_my_customer_loyalty_overview\(\) from public,anon,authenticated/);
assert.match(overnight,/::date=p_date/);
assert.doesNotMatch(rpcs+booking+loyalty,/grant execute on function public\.[a-z_]+\([^;]+to anon/);
const agenda=await readFile(new URL("../../src/agenda/pages/agenda-page.js",import.meta.url),"utf8");
const client=await readFile(new URL("../../cliente/app.js",import.meta.url),"utf8");
assert.match(agenda,/mountAgendaOffers/);
assert.match(client,/renderLoyaltyView/);
console.log("Contratos de espera, combos e fidelidade: OK (integração autenticada pendente).");
