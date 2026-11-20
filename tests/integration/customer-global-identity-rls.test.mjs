/**
 * Testes de integração da identidade global da cliente e de seu isolamento por tenant.
 *
 * Responsabilidade:
 * - validar leitura restrita por auth.uid() nas tabelas globais;
 * - impedir escrita direta em memberships e associações legadas;
 * - impedir que a cliente marque o próprio telefone como verificado;
 * - validar a associação assistida quando o ambiente de QA estiver configurado.
 *
 * Segurança:
 * - usar exclusivamente tokens de usuários reais de QA;
 * - nunca colocar service_role neste teste;
 * - nunca apontar para produção;
 * - usar duas organizações e contas sem dados pessoais reais.
 *
 * Variáveis obrigatórias:
 * SUPABASE_URL, SUPABASE_ANON_KEY,
 * CUSTOMER_A_ACCESS_TOKEN, CUSTOMER_B_ACCESS_TOKEN,
 * CUSTOMER_A_ID, CUSTOMER_B_ID, ORG_A_ID, ORG_B_ID.
 *
 * Variáveis adicionais para testar RPCs:
 * CUSTOMER_A_OWNER_ACCESS_TOKEN, CUSTOMER_A_PROFESSIONAL_ACCESS_TOKEN,
 * ORG_A_CUSTOMER_ID, ORG_B_CUSTOMER_ID.
 */

import assert from "node:assert/strict";

const ENV = process.env;
const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "CUSTOMER_A_ACCESS_TOKEN",
  "CUSTOMER_B_ACCESS_TOKEN",
  "CUSTOMER_A_ID",
  "CUSTOMER_B_ID",
  "ORG_A_ID",
  "ORG_B_ID"
];

const missing = REQUIRED.filter((key) => !ENV[key]);
if (missing.length > 0) {
  console.log(
    "Teste de identidade global não executado: ambiente de QA incompleto (" +
      missing.join(", ") +
      ")."
  );
  process.exit(0);
}

const REST_BASE = ENV.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Executa uma chamada autenticada à API do Supabase.
 *
 * @param {string|null} token - JWT do usuário de QA; null representa acesso anônimo.
 * @param {string} path - Caminho REST ou RPC relativo à API.
 * @param {{method?:string, body?:unknown}} options - Método HTTP e corpo opcional.
 * @returns {Promise<{ok:boolean,status:number,body:unknown}>} Resultado HTTP interpretado.
 * @throws {Error} Quando há falha de rede ou tempo limite.
 */
async function request(token, path, options = {}) {
  const { method = "GET", body } = options;
  const headers = {
    apikey: ENV.SUPABASE_ANON_KEY,
    Accept: "application/json"
  };

  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(REST_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "tempo limite excedido"
      : "falha de rede";
    throw new Error("Não foi possível concluir a chamada de QA: " + reason + ".");
  }

  const raw = await response.text();
  let parsed = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  return { ok: response.ok, status: response.status, body: parsed };
}

/**
 * Confirma que uma operação privilegiada ou escrita direta foi rejeitada.
 *
 * @param {Promise<{ok:boolean,status:number,body:unknown}>} result - Chamada executada.
 * @param {string} description - Nome do cenário de segurança.
 * @returns {void}
 * @throws {AssertionError} Se a API aceitar a operação indevida.
 */
function expectDenied(result, description) {
  assert.equal(result.ok, false, description + " não deveria ser permitido.");
}

/**
 * Executa uma RPC e verifica se a resposta foi aceita.
 *
 * @param {string} token - JWT do usuário autenticado.
 * @param {string} functionName - Nome público da RPC.
 * @param {object} args - Argumentos nomeados da função.
 * @returns {Promise<unknown>} Corpo retornado pela RPC.
 * @throws {AssertionError} Se a API rejeitar uma operação autorizada.
 */
async function expectRpcSuccess(token, functionName, args) {
  const result = await request(token, "/rpc/" + functionName, {
    method: "POST",
    body: args
  });
  assert.equal(
    result.ok,
    true,
    "RPC " + functionName + " deveria ser aceita; HTTP " + result.status
  );
  return result.body;
}

const customerA = ENV.CUSTOMER_A_ACCESS_TOKEN;
const customerB = ENV.CUSTOMER_B_ACCESS_TOKEN;
const customerAId = encodeURIComponent(ENV.CUSTOMER_A_ID);
const customerBId = encodeURIComponent(ENV.CUSTOMER_B_ID);
const orgAId = encodeURIComponent(ENV.ORG_A_ID);
const orgBId = encodeURIComponent(ENV.ORG_B_ID);

// ---------------------------------------------------------------------------
// 1. Perfis globais: cada cliente só consulta o próprio auth_user_id.
// ---------------------------------------------------------------------------
const aOwn = await request(
  customerA,
  "/customer_profiles?select=auth_user_id&auth_user_id=eq." + customerAId
);
assert.equal(aOwn.ok, true, "Cliente A deve consultar o próprio perfil.");
assert.equal(aOwn.body.length, 1, "O perfil da cliente A deve existir no ambiente de QA.");
assert.ok(
  Array.isArray(aOwn.body) &&
    aOwn.body.every((row) => row.auth_user_id === ENV.CUSTOMER_A_ID),
  "Cliente A não pode receber perfil de outra pessoa."
);

const aOther = await request(
  customerA,
  "/customer_profiles?select=auth_user_id&auth_user_id=eq." + customerBId
);
assert.equal(aOther.ok, true, "Consulta RLS de perfil cruzado deve ser processada.");
assert.equal(aOther.body.length, 0, "Cliente A não pode consultar o perfil de B.");

// ---------------------------------------------------------------------------
// 2. Memberships e associações: somente linhas da própria identidade.
// ---------------------------------------------------------------------------
const aMemberships = await request(
  customerA,
  "/customer_tenant_memberships?select=org_id,auth_user_id"
);
assert.equal(aMemberships.ok, true, "Cliente A deve consultar seus vínculos.");
assert.ok(
  aMemberships.body.every((row) => row.auth_user_id === ENV.CUSTOMER_A_ID),
  "Memberships de outra cliente não podem vazar."
);

const aCannotReadBMembership = await request(
  customerA,
  "/customer_tenant_memberships?select=org_id,auth_user_id&org_id=eq." +
    orgBId +
    "&auth_user_id=eq." +
    customerBId
);
assert.equal(aCannotReadBMembership.ok, true, "Consulta cruzada de membership deve ser processada.");
assert.equal(aCannotReadBMembership.body.length, 0, "Cliente A não pode consultar membership de B.");

const aCannotReadBMapping = await request(
  customerA,
  "/customer_account_customers?select=org_id,auth_user_id&org_id=eq." +
    orgBId +
    "&auth_user_id=eq." +
    customerBId
);
assert.equal(aCannotReadBMapping.ok, true, "Consulta cruzada de associação deve ser processada.");
assert.equal(aCannotReadBMapping.body.length, 0, "Cliente A não pode consultar associação legada de B.");

const bMappings = await request(
  customerB,
  "/customer_account_customers?select=org_id,auth_user_id"
);
assert.equal(bMappings.ok, true, "Cliente B deve consultar seus vínculos legados.");
assert.ok(
  bMappings.body.every((row) => row.auth_user_id === ENV.CUSTOMER_B_ID),
  "Associações legadas de outra cliente não podem vazar."
);

// ---------------------------------------------------------------------------
// 3. O cliente não pode criar memberships nem associações diretamente.
// ---------------------------------------------------------------------------
const directMembershipInsert = await request(
  customerA,
  "/customer_tenant_memberships",
  {
    method: "POST",
    body: {
      org_id: ENV.ORG_A_ID,
      auth_user_id: ENV.CUSTOMER_B_ID,
      status: "active",
      source: "booking_link"
    }
  }
);
expectDenied(directMembershipInsert, "Criação direta de membership");

const directMappingInsert = await request(
  customerA,
  "/customer_account_customers",
  {
    method: "POST",
    body: {
      org_id: ENV.ORG_A_ID,
      auth_user_id: ENV.CUSTOMER_A_ID,
      customer_id: "00000000-0000-4000-8000-000000000001",
      link_source: "staff_confirmed"
    }
  }
);
expectDenied(directMappingInsert, "Criação direta de associação legada");

// ---------------------------------------------------------------------------
// 4. Telefone verificado é campo protegido pelo banco.
// ---------------------------------------------------------------------------
const verifiedPhoneWrite = await request(
  customerA,
  "/customer_profiles?auth_user_id=eq." + customerAId,
  {
    method: "PATCH",
    body: { phone_verified_at: new Date().toISOString() }
  }
);
expectDenied(verifiedPhoneWrite, "Alteração direta de phone_verified_at");

// ---------------------------------------------------------------------------
// 5. RPC controlada: associação assistida, autorizada e idempotente.
//    A ativação de membership por reserva será testada junto da RPC transacional
//    de HOLD/agendamento, quando esse fluxo estiver implementado.
// ---------------------------------------------------------------------------
const RPC_ENV = [
  "CUSTOMER_A_OWNER_ACCESS_TOKEN",
  "ORG_A_CUSTOMER_ID",
  "ORG_B_CUSTOMER_ID"
];
const missingRpcEnv = RPC_ENV.filter((key) => !ENV[key]);

if (missingRpcEnv.length === 0) {
  const ownerA = ENV.CUSTOMER_A_OWNER_ACCESS_TOKEN;
  const linkArgs = {
    p_org_id: ENV.ORG_A_ID,
    p_customer_id: ENV.ORG_A_CUSTOMER_ID,
    p_auth_user_id: ENV.CUSTOMER_A_ID
  };

  // A cliente não pode invocar a função reservada à equipe do salão.
  const customerCannotLink = await request(customerA, "/rpc/link_customer_legacy", {
    method: "POST",
    body: linkArgs
  });
  expectDenied(customerCannotLink, "Associação de cadastro por conta de cliente");

  const anonymousCannotLink = await request(null, "/rpc/link_customer_legacy", {
    method: "POST",
    body: linkArgs
  });
  expectDenied(anonymousCannotLink, "Associação de cadastro por sessão anônima");

  if (ENV.CUSTOMER_A_PROFESSIONAL_ACCESS_TOKEN) {
    const professionalCannotLink = await request(
      ENV.CUSTOMER_A_PROFESSIONAL_ACCESS_TOKEN,
      "/rpc/link_customer_legacy",
      { method: "POST", body: linkArgs }
    );
    expectDenied(professionalCannotLink, "Associação de cadastro por profissional");
  }

  const linked = await expectRpcSuccess(ownerA, "link_customer_legacy", linkArgs);
  assert.equal(linked, ENV.ORG_A_CUSTOMER_ID, "A RPC deve retornar o cadastro associado.");

  // Repetir a mesma associação não pode criar uma segunda linha.
  const linkedAgain = await expectRpcSuccess(ownerA, "link_customer_legacy", linkArgs);
  assert.equal(linkedAgain, ENV.ORG_A_CUSTOMER_ID);

  const mapping = await request(
    customerA,
    "/customer_account_customers?select=org_id,auth_user_id,customer_id&org_id=eq." +
      orgAId +
      "&auth_user_id=eq." +
      customerAId
  );
  assert.equal(mapping.ok, true, "A cliente deve consultar sua associação confirmada.");
  assert.equal(mapping.body.length, 1, "A associação idempotente deve existir uma única vez.");
  assert.equal(mapping.body[0].customer_id, ENV.ORG_A_CUSTOMER_ID);

  const crossTenantLink = await request(ownerA, "/rpc/link_customer_legacy", {
    method: "POST",
    body: {
      p_org_id: ENV.ORG_B_ID,
      p_customer_id: ENV.ORG_B_CUSTOMER_ID,
      p_auth_user_id: ENV.CUSTOMER_A_ID
    }
  });
  expectDenied(crossTenantLink, "Associação de cliente em organização alheia");

  const mismatchedCustomerLink = await request(ownerA, "/rpc/link_customer_legacy", {
    method: "POST",
    body: {
      p_org_id: ENV.ORG_A_ID,
      p_customer_id: ENV.ORG_B_CUSTOMER_ID,
      p_auth_user_id: ENV.CUSTOMER_A_ID
    }
  });
  expectDenied(mismatchedCustomerLink, "Associação de cadastro pertencente a outro salão");
} else {
  console.log(
    "Teste da RPC de associação não executado: faltam variáveis de QA (" +
      missingRpcEnv.join(", ") +
      ")."
  );
}
console.log("Testes RLS da identidade global concluídos.");
