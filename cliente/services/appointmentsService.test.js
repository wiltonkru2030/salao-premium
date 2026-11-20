/**
 * Testes do serviço de histórico da Área da Cliente.
 * Responsabilidade: validar paginação, ausência de IDs de terceiros e falhas seguras.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 */
import assert from "node:assert/strict";
import { fetchMyCustomerAppointments } from "./appointmentsService.js";

const PAGE_SIZE = 250;

/** Cria RPC simulada com paginação e registro de chamadas. */
function mockClient(responses) {
  const calls = [];
  return {
    calls,
    client: {
      rpc(name) {
        const call = { name, range: null, orders: [] };
        calls.push(call);
        const query = {
          order(...args) { call.orders.push(args); return this; },
          range(start, end) { call.range = [start, end]; return this; },
          then(resolve, reject) {
            const offset = call.range?.[0] || 0;
            const response = responses[offset] ?? responses[0];
            return Promise.resolve(response).then(resolve, reject);
          }
        };
        return query;
      }
    }
  };
}

/** Executa cenários de histórico, paginação e falha. */
async function run() {
  const rows = [{ appointment_id: "appointment-1", salon_name: "Studio" }];
  const basic = mockClient({ 0: { data: rows, error: null } });
  assert.deepEqual(await fetchMyCustomerAppointments({ client: basic.client }), rows);
  assert.equal(basic.calls[0].name, "get_my_customer_appointments");
  assert.deepEqual(basic.calls[0].range, [0, PAGE_SIZE - 1]);
  assert.deepEqual(basic.calls[0].orders, [["starts_at", {ascending:false}], ["appointment_id", {ascending:false}]]);

  const first = Array.from({ length: PAGE_SIZE }, (_, index) => ({ appointment_id: "a-" + index }));
  const second = [{ appointment_id: "a-250" }];
  const paged = mockClient({
    0: { data: first, error: null },
    250: { data: second, error: null }
  });
  const complete = await fetchMyCustomerAppointments({ client: paged.client });
  assert.equal(complete.length, 251);
  assert.deepEqual(paged.calls.map(call => call.range), [[0, 249], [250, 499]]);

  const missing = mockClient({ 0: { data: null, error: { code: "PGRST202" } } });
  await assert.rejects(() => fetchMyCustomerAppointments({ client: missing.client }),
    error => error.code === "CUSTOMER_APPOINTMENTS_NOT_READY"
      && error.message.includes("ainda está sendo ativado"));

  const failed = mockClient({ 0: { data: null, error: { code: "XX000", message: "SQL privado" } } });
  await assert.rejects(() => fetchMyCustomerAppointments({ client: failed.client }),
    error => error.message.includes("Não foi possível carregar seus agendamentos")
      && !error.message.includes("SQL privado"));

  await assert.rejects(() => fetchMyCustomerAppointments({ client: {} }), { name: "TypeError" });
  console.log("Testes do histórico de agendamentos da cliente: OK");
}

run().catch(error => {
  process.stderr.write("Falha nos testes de histórico da cliente: " + error.message + "\n");
  process.exitCode = 1;
});
