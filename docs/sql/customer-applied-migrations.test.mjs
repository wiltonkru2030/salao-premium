/**
 * Testes estáticos das migrations já aplicadas para vitrine, disponibilidade e cupons.
 * Responsabilidade: proteger o contrato versionado que corresponde ao schema Supabase conectado.
 * Limite: não substitui consulta de pg_proc/RLS em runtime nem testes transacionais com usuários reais.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../../supabase/migrations/",import.meta.url);
async function migration(name) {
  return readFile(new URL(name,root),"utf8");
}
function checkTransaction(sql,name) {
  assert.match(sql,/\bbegin\s*;/i,name+" precisa abrir transação.");
  assert.match(sql,/\bcommit\s*;\s*$/i,name+" precisa fechar transação.");
}
function checkFunctions(sql,expected) {
  const blocks=[...sql.matchAll(/create or replace function\s+((?:public|private)\.[a-z0-9_]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
  for(const fn of blocks) {
    const name=fn[1].toLowerCase(),header=fn[2].toLowerCase();
    if(name.startsWith("public.")) {
      assert.match(header,/security invoker/,name+" precisa ser SECURITY INVOKER.");
      assert.doesNotMatch(header,/security definer/,name+" não pode ser SECURITY DEFINER.");
    } else {
      assert.match(header,/security definer/,name+" precisa encapsular acesso privilegiado.");
      assert.match(header,/set search_path\s*=\s*''/,name+" precisa search_path vazio.");
    }
  }
  for(const name of expected)assert.ok(blocks.some(fn=>fn[1].toLowerCase()===name),"RPC ausente: "+name);
  return blocks;
}

async function run() {
  const directory=await migration("20261120064407_public_salon_directory_and_availability.sql");
  const aligned=await migration("20261120064553_align_public_profiles_with_settings.sql");
  const privateApi=await migration("20261120064639_restrict_private_schema_public_api.sql");
  const memberRead=await migration("20261120064758_allow_members_read_public_profile_settings.sql");
  const coupons=await migration("20261120065524_customer_coupons_transactional.sql");
  const legacy=await migration("20261120065604_restrict_legacy_hold_private_entrypoints.sql");
  const couponCleanup=await migration("20261120070111_coupon_fk_indexes_and_public_profile_policy_cleanup.sql");

  for(const [sql,name] of [
    [directory,"Diretório público"],[aligned,"Alinhamento da vitrine"],
    [privateApi,"Schema privado"],[memberRead,"Leitura de membros"],
    [coupons,"Cupons"],[legacy,"RPCs legadas"],[couponCleanup,"Índices e políticas"]
  ])checkTransaction(sql,name);

  checkFunctions(directory,[
    "private.search_public_salons","public.search_public_salons",
    "private.get_public_salon_catalog","public.get_public_salon_catalog",
    "private.get_customer_available_slots","public.get_customer_available_slots"
  ]);
  checkFunctions(aligned,[
    "private.save_public_salon_profile","public.save_public_salon_profile",
    "private.search_public_salons","public.search_public_salons",
    "private.get_public_salon_catalog","public.get_public_salon_catalog",
    "private.get_customer_available_slots","public.get_customer_available_slots"
  ]);
  checkFunctions(coupons,[
    "private.save_salon_coupon","public.save_salon_coupon",
    "private.deactivate_salon_coupon","public.deactivate_salon_coupon",
    "private.compute_customer_coupon","public.validate_public_coupon",
    "private.create_customer_appointment_hold_with_coupon","public.create_customer_appointment_hold_with_coupon",
    "private.confirm_customer_appointment_hold_with_coupon","public.confirm_customer_appointment_hold_with_coupon",
    "private.cancel_customer_appointment_hold_with_coupon","public.cancel_customer_appointment_hold_with_coupon"
  ]);

  const combined=(directory+"\n"+aligned+"\n"+privateApi+"\n"+memberRead+"\n"+coupons+"\n"+legacy+"\n"+couponCleanup).toLowerCase();
  assert.match(combined,/create table if not exists public\.salon_coupons/);
  assert.match(combined,/create table if not exists public\.salon_coupon_services/);
  assert.match(combined,/create table if not exists public\.customer_coupon_redemptions/);
  assert.match(combined,/create policy salon_public_profiles_member_read/);
  assert.match(combined,/create policy branch_public_profiles_member_read/);
  assert.match(combined,/create_customer_appointment_hold_with_coupon/);
  assert.match(combined,/revoke all on function public\.create_customer_appointment_hold/);
  assert.match(combined,/revoke all on function public\.confirm_customer_appointment_hold/);
  assert.match(combined,/revoke all on function public\.cancel_customer_appointment_hold/);
  assert.match(couponCleanup.toLowerCase(),/salon_coupon_services_org_service_fk_idx/);
  assert.match(privateApi.toLowerCase(),/grant execute on function private\.search_public_salons/);
  assert.match(privateApi.toLowerCase(),/to anon, authenticated/);
  assert.doesNotMatch(coupons.toLowerCase(),/grant execute on function public\.[a-z0-9_]+\([^;]+to anon/);

  console.log("Migrations aplicadas de vitrine, disponibilidade e cupons: contrato estático OK.");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
