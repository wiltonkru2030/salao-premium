/**
 * Teste de integração RLS da identidade global.
 * Executar somente em ambiente de QA com dois usuários e dois tenants de teste.
 * Não utiliza service_role: cada cliente usa seu próprio access token.
 *
 * Variáveis necessárias:
 * SUPABASE_URL, SUPABASE_ANON_KEY,
 * CUSTOMER_A_ACCESS_TOKEN, CUSTOMER_B_ACCESS_TOKEN,
 * CUSTOMER_A_ID, CUSTOMER_B_ID, ORG_A_ID, ORG_B_ID.
 */
import assert from "node:assert/strict";

const required = [
  "SUPABASE_URL","SUPABASE_ANON_KEY","CUSTOMER_A_ACCESS_TOKEN","CUSTOMER_B_ACCESS_TOKEN",
  "CUSTOMER_A_ID","CUSTOMER_B_ID","ORG_A_ID","ORG_B_ID"
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.log("Teste RLS global ignorado: ambiente de QA não configurado (" + missing.join(", ") + ").");
  process.exit(0);
}

const base = process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
async function request(token, path) {
  const response = await fetch(base + path, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  });
  const body = await response.text();
  return { status: response.status, body: body ? JSON.parse(body) : null };
}
const aOwn = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_profiles?select=auth_user_id&auth_user_id=eq." + process.env.CUSTOMER_A_ID);
assert.ok(aOwn.status >= 200 && aOwn.status < 300, "Cliente A deve consultar o próprio perfil.");
assert.ok(aOwn.body.every(row => row.auth_user_id === process.env.CUSTOMER_A_ID), "Cliente A não pode receber perfil de outra pessoa.");

const aOther = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_profiles?select=auth_user_id&auth_user_id=eq." + process.env.CUSTOMER_B_ID);
assert.ok(aOther.status >= 200 && aOther.status < 300, "Consulta RLS deve ser processada.");
assert.equal(aOther.body.length, 0, "Cliente A não pode consultar o perfil de B.");

const aMemberships = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_tenant_memberships?select=org_id,auth_user_id");
assert.ok(aMemberships.status >= 200 && aMemberships.status < 300, "Cliente A deve consultar os próprios vínculos.");
assert.ok(aMemberships.body.every(row => row.auth_user_id === process.env.CUSTOMER_A_ID), "Memberships de outra cliente não podem vazar.");

const aCannotReadBMembership = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_tenant_memberships?select=org_id,auth_user_id&auth_user_id=eq." + process.env.CUSTOMER_B_ID);
assert.ok(aCannotReadBMembership.status >= 200 && aCannotReadBMembership.status < 300, "Consulta cruzada de membership deve ser processada.");
assert.equal(aCannotReadBMembership.body.length, 0, "Cliente A não pode consultar membership de B.");

const aCannotReadBMapping = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_account_customers?select=org_id,auth_user_id&auth_user_id=eq." + process.env.CUSTOMER_B_ID);
assert.ok(aCannotReadBMapping.status >= 200 && aCannotReadBMapping.status < 300, "Consulta cruzada de associação deve ser processada.");
assert.equal(aCannotReadBMapping.body.length, 0, "Cliente A não pode consultar associação legada de B.");

const bMappings = await request(process.env.CUSTOMER_B_ACCESS_TOKEN, "/customer_account_customers?select=org_id,auth_user_id");
assert.ok(bMappings.status >= 200 && bMappings.status < 300, "Cliente B deve consultar seus vínculos legados.");
assert.ok(bMappings.body.every(row => row.auth_user_id === process.env.CUSTOMER_B_ID), "Associações legadas de outra cliente não podem vazar.");

console.log("Testes RLS de leitura da identidade global concluídos.");
