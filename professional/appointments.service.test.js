/**
 * Testes do serviço de consulta de agendamentos do App Profissional.
 *
 * Responsabilidade: verificar validações, intervalo mensal, ordenação e falhas do serviço.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: importa appointments.service.js e utiliza um cliente Supabase simulado,
 * sem rede, banco real ou dependências externas.
 */
import assert from "node:assert/strict";
import { fetchProfessionalAppointments } from "./appointments.service.js";

/**
 * Cria um cliente Supabase simulado que registra os filtros aplicados à consulta.
 *
 * @param {object} result Resposta simulada do Supabase.
 * @returns {{client: object, calls: object}} Cliente falso e filtros capturados.
 */
function createClient(result) {
  const calls = { table: null, filters: [], selection: null, order: null, limit: null };
  const query = {
    select(value) { calls.selection = value; return this; },
    eq(...value) { calls.filters.push(["eq", ...value]); return this; },
    gte(...value) { calls.filters.push(["gte", ...value]); return this; },
    lt(...value) { calls.filters.push(["lt", ...value]); return this; },
    order(...value) { calls.order = value; return this; },
    limit(value) { calls.limit = value; return Promise.resolve(result); }
  };
  return {
    calls,
    client: { from(table) { calls.table = table; return query; } }
  };
}

/** Executa a suíte e encerra com erro caso qualquer expectativa falhe. */
async function run() {
  const rows = [{ id: "a1" }];
  const mock = createClient({ data: rows, error: null });
  const result = await fetchProfessionalAppointments({
    client: mock.client,
    organizationId: "org-1",
    month: new Date(2026, 1, 18)
  });

  assert.deepEqual(result, rows);
  assert.equal(mock.calls.table, "appointments");
  assert.ok(mock.calls.selection.split(',').includes('created_at'));
  assert.ok(mock.calls.selection.split(',').includes('created_by_name'));
  assert.ok(mock.calls.filters.some(([kind, field, value]) =>
    kind === "eq" && field === "org_id" && value === "org-1"));
  assert.ok(mock.calls.filters.some(([kind, field, value]) =>
    kind === "gte" && field === "starts_at" && value === new Date(2026, 1, 1).toISOString()));
  assert.ok(mock.calls.filters.some(([kind, field, value]) =>
    kind === "lt" && field === "starts_at" && value === new Date(2026, 2, 1).toISOString()));
  assert.equal(mock.calls.limit, 1000);

  const empty = createClient({ data: null, error: null });
  assert.deepEqual(await fetchProfessionalAppointments({
    client: empty.client,
    organizationId: "org-1",
    month: new Date(2026, 0, 1)
  }), []);

  await assert.rejects(
    () => fetchProfessionalAppointments({ client: mock.client, organizationId: "", month: new Date() }),
    { name: "TypeError" }
  );
  await assert.rejects(
    () => fetchProfessionalAppointments({ client: mock.client, organizationId: "org-1", month: new Date("inválida") }),
    { name: "TypeError" }
  );
  await assert.rejects(
    () => fetchProfessionalAppointments({ client: mock.client, organizationId: "org-1", month: new Date(), limit: 0 }),
    { name: "TypeError" }
  );

  const failed = createClient({ data: null, error: { message: "detalhe interno do banco" } });
  await assert.rejects(
    () => fetchProfessionalAppointments({ client: failed.client, organizationId: "org-1", month: new Date() }),
    error => error.message.includes("Não foi possível carregar") && !error.message.includes("detalhe interno")
  );

  process.stdout.write("Testes do serviço de agendamentos aprovados.\n");
}

run().catch(error => {
  process.stderr.write("Falha nos testes do serviço de agendamentos: " + error.message + "\n");
  process.exitCode = 1;
});

// O intervalo da consulta parte da meia-noite do salão, mesmo em outro fuso.
const salonMonth = createClient({data:[],error:null});
await fetchProfessionalAppointments({
  client:salonMonth.client,organizationId:"org-1",month:new Date(2026,10,1),timezone:"America/Manaus"
});
assert.deepEqual(salonMonth.calls.filters.filter(([operation])=>["gte","lt"].includes(operation)),[
  ["gte","starts_at","2026-11-01T04:00:00.000Z"],
  ["lt","starts_at","2026-12-01T04:00:00.000Z"]
]);
