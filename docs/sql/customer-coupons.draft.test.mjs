/**
 * Teste estático do rascunho SQL de cupons.
 * Responsabilidade: impedir regressões de estrutura, grants e segurança antes de revisão/aplicação.
 * Limite: não substitui validação sintática PostgreSQL nem teste transacional em ambiente isolado.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("./customer-coupons.draft.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();

assert.match(normalized,/^\s*--\s*rascunho/m);
assert.match(normalized,/\bbegin\s*;/);
assert.match(normalized,/\bcommit\s*;\s*$/);
assert.equal((sql.match(/as \$function\$/g)||[]).length,(sql.match(/\$function\$;/g)||[]).length,
  "Todo corpo PL/pgSQL/SQL deve fechar seu delimitador.");
assert.doesNotMatch(normalized,/drop\s+table|truncate\s+table/);

for(const table of ["salon_coupons","salon_coupon_services","customer_coupon_redemptions"]) {
  assert.match(normalized,new RegExp("create table if not exists public\\."+table+"\\b"));
  assert.match(normalized,new RegExp("alter table public\\."+table+" enable row level security"));
}
assert.match(normalized,/create unique index if not exists customer_coupon_redemptions_hold_unique/);
assert.match(normalized,/for update\s*;/,"O cupom precisa ser bloqueado durante a reserva para serializar limites.");

const functions=[...sql.matchAll(/create or replace function\s+((?:public|private)\.[a-z0-9_]+)\s*\([\s\S]*?\)\s*([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
const names=functions.map(match=>match[1].toLowerCase());
assert.equal(names.length,13,"Quantidade inesperada de RPCs/funções.");
assert.equal(new Set(names).size,names.length,"Não pode haver funções duplicadas.");
for(const expected of [
  "private.save_salon_coupon","public.save_salon_coupon",
  "private.deactivate_salon_coupon","public.deactivate_salon_coupon",
  "private.compute_customer_coupon","public.validate_public_coupon",
  "private.create_customer_appointment_hold_with_coupon","public.create_customer_appointment_hold_with_coupon",
  "private.confirm_customer_appointment_hold_with_coupon","public.confirm_customer_appointment_hold_with_coupon",
  "private.release_coupon_reservation_on_hold_end",
  "private.cancel_customer_appointment_hold_with_coupon","public.cancel_customer_appointment_hold_with_coupon"
]) assert.ok(names.includes(expected),"Função ausente: "+expected);

for(const match of functions) {
  const name=match[1].toLowerCase();
  const header=match[2].toLowerCase();
  if(name.startsWith("private.")) {
    assert.match(header,/security definer/,name+" deve encapsular a operação privilegiada.");
    assert.match(header,/set search_path\s*=\s*''/,name+" deve fixar search_path vazio.");
  } else {
    assert.match(header,/security invoker/,name+" deve permanecer SECURITY INVOKER.");
    assert.doesNotMatch(header,/security definer/,name+" não pode ser SECURITY DEFINER em schema público.");
  }
}
for(const legacy of [
  "create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)",
  "confirm_customer_appointment_hold(uuid)",
  "cancel_customer_appointment_hold(uuid)"
]) assert.ok(normalized.includes("revoke all on function public."+legacy));

assert.match(normalized,/from public,anon,authenticated;\s*grant execute on function public\.save_salon_coupon/);
assert.match(normalized,/from public,anon,authenticated;\s*grant execute on function public\.create_customer_appointment_hold_with_coupon/);
assert.match(normalized,/revoke all on function private\.release_coupon_reservation_on_hold_end\(\) from public,anon,authenticated/);
assert.match(normalized,/create trigger appointment_hold_release_coupon_trigger/);
for(const table of ["salon_coupons","salon_coupon_services","customer_coupon_redemptions"]) {
  assert.match(normalized,new RegExp("create trigger audit_row_change after insert or update or delete on public\\."+table));
}
assert.match(normalized,/status='released'/);
assert.match(normalized,/status='redeemed'/);
assert.match(normalized,/private\.create_customer_appointment_hold\(/);

console.log("Contrato estático do SQL de cupons: OK (não equivale à execução no PostgreSQL).");
