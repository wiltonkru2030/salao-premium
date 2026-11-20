/**
 * Testes do extrato individual de comissões do App Profissional.
 *
 * Responsabilidade: validar isolamento, paginação integral e mensagens seguras.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: simula o cliente Supabase usado por commissions.service.js.
 */
import assert from "node:assert/strict";
import { fetchProfessionalCommissions } from "./commissions.service.js";

const PAGE_SIZE = 250;

/**
 * Cria cliente Supabase simulado e registra filtros, ordenação e intervalos.
 * @param {object} responses Respostas por tabela e página.
 * @returns {{client:object,calls:Array<object>}} Cliente e consultas capturadas.
 */
function mockClient(responses) {
  const calls = [];
  const client = {
    from(table) {
      const call = { table, filters: [], selection: "", order: null, range: null };
      calls.push(call);
      const query = {
        select(value) { call.selection = value; return this; },
        eq(...args) { call.filters.push(args); return this; },
        order(...args) { call.order = args; return this; },
        range(start, end) { call.range = [start, end]; return this; },
        then(resolve, reject) {
          const key = call.range?.[0] || 0;
          const response = responses[table]?.[key] ?? responses[table];
          return Promise.resolve(response).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { client, calls };
}

/** Executa cenários de leitura, paginação, validação e falhas sem vazamento técnico. */
async function run() {
  const commissionRows = [{ id: "commission-1", amount: 25 }];
  const payoutRows = [{ id: "payout-1", amount: 25 }];
  const mock = mockClient({
    commissions: { data: commissionRows, error: null },
    commission_payouts: { data: payoutRows, error: null }
  });
  const result = await fetchProfessionalCommissions({
    client: mock.client, organizationId: "org-1", professionalId: "professional-1"
  });
  assert.deepEqual(result.commissions, commissionRows);
  assert.deepEqual(result.payouts, payoutRows);
  assert.equal(mock.calls.length, 2);
  for (const call of mock.calls) {
    assert.ok(call.filters.some(([field, value]) => field === "org_id" && value === "org-1"));
    assert.ok(call.filters.some(([field, value]) => field === "professional_id" && value === "professional-1"));
    assert.deepEqual(call.range, [0, PAGE_SIZE - 1]);
    assert.ok(call.order);
  }

  const firstPage = Array.from({ length: PAGE_SIZE }, (_, index) => ({ id: `commission-${index}` }));
  const secondPage = [{ id: "commission-250" }];
  const paginated = mockClient({
    commissions: {
      0: { data: firstPage, error: null },
      250: { data: secondPage, error: null }
    },
    commission_payouts: { data: [], error: null }
  });
  const complete = await fetchProfessionalCommissions({
    client: paginated.client, organizationId: "org-1", professionalId: "professional-1"
  });
  assert.equal(complete.commissions.length, 251);
  assert.equal(complete.commissions[250].id, "commission-250");
  assert.deepEqual(paginated.calls.filter(call => call.table === "commissions").map(call => call.range),
    [[0, 249], [250, 499]]);

  await assert.rejects(() => fetchProfessionalCommissions({
    client: mock.client, organizationId: "org-1", professionalId: ""
  }), { name: "TypeError" });

  const failed = mockClient({
    commissions: { data: null, error: { message: "detalhe SQL privado" } },
    commission_payouts: { data: [], error: null }
  });
  await assert.rejects(() => fetchProfessionalCommissions({
    client: failed.client, organizationId: "org-1", professionalId: "professional-1"
  }), error => error.message.includes("Não foi possível carregar suas comissões")
    && !error.message.includes("detalhe SQL"));

  process.stdout.write("Testes do extrato individual de comissões aprovados.\n");
}

run().catch(error => {
  process.stderr.write("Falha nos testes de comissões: " + error.message + "\n");
  process.exitCode = 1;
});
