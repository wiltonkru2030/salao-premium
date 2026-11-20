/**
 * Teste de integração RLS da identidade global.
 * Executar somente em ambiente de QA com dois usuários e dois tenants de teste.
 * Não utiliza service_role: cada cliente usa seu próprio access token.
 *
 * Variáveis necessárias:
 * SUPABASE_URL, SUPABASE_ANON_KEY,
 * CUSTOMER_A_ACCESS_TOKEN, CUSTOMER_B_ACCESS_TOKEN,
 * CUSTOMER_A_ID, CUSTOMER_B_ID, ORG_A_ID, ORG_B_ID.
 *
 * Este teste valida leitura cruzada e também confirma que o navegador não pode
 * criar memberships/associações nem marcar o próprio telefone como verificado.
 */
import assert from "node:assert/strict";

const required = [
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "CUSTOMER_A_ACCESS_TOKEN", "CUSTOMER_B_ACCESS_TOKEN",
  "CUSTOMER_A_ID", "CUSTOMER_B_ID", "ORG_A_ID", "ORG_B_ID"
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.log("Teste RLS global ignorado: ambiente de QA não configurado (" + missing.join(", ") + ").");
  process.exit(0);
}

const base = process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

/** Executa uma chamada PostgREST usando exclusivamente a sessão do cliente testado. */
async function request(token, path, options = {}) {
  const headers = {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: "Bearer " + token,
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json", Prefer: "return=representation" } : {})
  };
  const response = await fetch(base + path, {
    method: options.method || "GET",
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const body = await response.text();
  let parsed = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { parsed = body; }
  return { status: response.status, body: parsed };
}

/** Asserção comum para garantir que a consulta foi aceita pelo PostgREST. */
function assertSuccess(result, message) {
  assert.ok(result.status >= 200 && result.status < 300, message + " (HTTP " + result.status + ")");
}

/** Asserção comum para operações que devem ser bloqueadas por grants/RLS. */
function assertDenied(result, message) {
  assert.ok(
    result.status === 401 || result.status === 403 || result.status === 404,
    message + " (HTTP " + result.status + ")"
  );
}

const aOwn = await request(
  process.env.CUSTOMER_A_ACCESS_TOKEN,
  "/customer_profiles?select=auth_user_id&auth_user_id=eq." + process.env.CUSTOMER_A_ID
);
assertSuccess(aOwn, "Cliente A deve consultar o próprio perfil.");
assert.ok(aOwn.body.every(row => row.auth_user_id === process.env.CUSTOMER_A_ID), "Cliente A não pode receber perfil de outra pessoa.");

const aOther = await request(
  process.env.CUSTOMER_A_ACCESS_TOKEN,
  "/customer_profiles?select=auth_user_id&auth_user_id=eq." + process.env.CUSTOMER_B_ID
);
assertSuccess(aOther, "Consulta RLS deve ser processada.");
assert.equal(aOther.body.length, 0, "Cliente A não pode consultar o perfil de B.");

const aMemberships = await request(
  process.env.CUSTOMER_A_ACCESS_TOKEN,
  "/customer_tenant_memberships?select=org_id,auth_user_id"
);
assertSuccess(aMemberships, "Cliente A deve consultar os próprios vínculos.");
assert.ok(aMemberships.body.every(row => row.auth_user_id === process.env.CUSTOMER_A_ID), "Memberships de outra cliente não podem vazar.");

const aCannotReadBMembership = await request(
  process.env.CUSTOMER_A_ACCESS_TOKEN,
  "/customer_tenant_memberships?select=org_id,auth_user_id&org_id=eq." + process.env.ORG_B_ID + "&auth_user_id=eq." + process.env.CUSTOMER_B_ID
);
assertSuccess(aCannotReadBMembership, "Consulta cruzada de membership deve ser processada.");
assert.equal(aCannotReadBMembership.body.length, 0, "Cliente A não pode consultar membership de B.");

const aCannotReadBMapping = await request(
  process.env.CUSTOMER_A_ACCESS_TOKEN,
  "/customer_account_customers?select=org_id,auth_user_id&org_id=eq." + process.env.ORG_B_ID + "&auth_user_id=eq." + process.env.CUSTOMER_B_ID
);
assertSuccess(aCannotReadBMapping, "Consulta cruzada de associação deve ser processada.");
assert.equal(aCannotReadBMapping.body.length, 0, "Cliente A não pode consultar associação legada de B.");

const bMappings = await request(
  process.env.CUSTOMER_B_ACCESS_TOKEN,
  "/customer_account_customers?select=org_id,auth_user_id"
);
assertSuccess(bMappings, "Cliente B deve consultar seus vínculos legados.");
assert.ok(bMappings.body.every(row => row.auth_user_id === process.env.CUSTOMER_B_ID), "Associações legadas de outra cliente não podem vazar.");

// O cliente não pode criar o próprio vínculo com uma organização arbitrária.
const createMembership = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_tenant_memberships", {
  method: "POST",
  body: {
    org_id: process.env.ORG_A_ID,
    auth_user_id: process.env.CUSTOMER_A_ID,
    status: "active",
    source: "customer_booking"
  }
});
assertDenied(createMembership, "Cliente não pode criar membership diretamente.");

// O cliente não pode forjar a associação com um cadastro legado de salão.
const createLegacyMapping = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_account_customers", {
  method: "POST",
  body: {
    org_id: process.env.ORG_A_ID,
    auth_user_id: process.env.CUSTOMER_A_ID,
    customer_id: "00000000-0000-4000-8000-000000000001",
    source: "customer_claim_reviewed"
  }
});
assertDenied(createLegacyMapping, "Cliente não pode associar cadastro legado diretamente.");

// O telefone só poderá ser marcado como verificado por um fluxo confiável de comprovação.
const forgePhoneVerification = await request(process.env.CUSTOMER_A_ACCESS_TOKEN, "/customer_profiles?auth_user_id=eq." + process.env.CUSTOMER_A_ID, {
  method: "PATCH",
  body: { phone_verified_at: new Date().toISOString() }
});
assertDenied(forgePhoneVerification, "Cliente não pode marcar o próprio telefone como verificado.");

console.log("Testes RLS globais de leitura, isolamento e bloqueio de escrita concluídos.");
