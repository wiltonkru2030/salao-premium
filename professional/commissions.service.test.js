/**
 * Testes do extrato individual de comissões do App Profissional.
 *
 * Responsabilidade: validar escopo por organização/profissional e tratamento de falhas.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: usa cliente Supabase simulado para commissions.service.js.
 */
import assert from "node:assert/strict";
import { fetchProfessionalCommissions } from "./commissions.service.js";

/**
 * Cria cliente Supabase simulado e registra as consultas.
 * @param {object} responses Respostas por tabela.
 * @returns {{client:object,calls:Array<object>}} Cliente e consultas capturadas.
 */
function mockClient(responses) {
  const calls = [];
  const client = {
    from(table) {
      const call = { table, filters: [], selection: "", order: null, limit: null };
      calls.push(call);
      const query = {
        select(value) { call.selection = value; return this; },
        eq(...args) { call.filters.push(args); return this; },
        order(...args) { call.order = args; return this; },
        limit(value) { call.limit = value; return this; },
        then(resolve, reject) { return Promise.resolve(responses[table]).then(resolve, reject); }
      };
      return query;
    }
  };
  return { client, calls };
}

/** Executa cenários positivos, validações e falhas de consulta. */
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
    assert.equal(call.limit, 250);
  }

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
