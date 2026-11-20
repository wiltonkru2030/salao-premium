/**
 * Testes do serviço de inclusão de serviços em comandas.
 *
 * Responsabilidade: verificar validações, payload persistido e mensagens de falha.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: testa order-items.service.js com cliente Supabase simulado.
 */
import assert from "node:assert/strict";
import { addProfessionalServiceToOrder } from "./order-items.service.js";

/**
 * Cria cliente falso que captura o payload de inserção.
 * @param {object} response Resposta simulada do Supabase.
 * @returns {{client: object, calls: object}} Cliente e dados capturados.
 */
function mockClient(response) {
  const calls = { table: "", payload: null };
  const query = {
    insert(payload) { calls.payload = payload; return Promise.resolve(response); }
  };
  return {
    calls,
    client: { from(table) { calls.table = table; return query; } }
  };
}

/** Executa os testes e sinaliza falhas ao processo do Node. */
async function run() {
  const mock = mockClient({ data: null, error: null });
  const fixedDate = new Date("2026-11-20T12:30:00.000Z");
  assert.equal(await addProfessionalServiceToOrder({
    client: mock.client,
    organizationId: "org-1",
    orderId: "order-1",
    service: { id: "service-1", name: "Corte", price: "49.999" },
    professionalId: "professional-1",
    userId: "user-1",
    performedAt: fixedDate
  }), true);

  assert.equal(mock.calls.table, "service_order_items");
  assert.equal(mock.calls.payload.org_id, "org-1");
  assert.equal(mock.calls.payload.order_id, "order-1");
  assert.equal(mock.calls.payload.service_id, "service-1");
  assert.equal(mock.calls.payload.professional_id, "professional-1");
  assert.equal(mock.calls.payload.created_by, "user-1");
  assert.equal(mock.calls.payload.unit_price, 50);
  assert.equal(mock.calls.payload.total, 50);
  assert.equal(mock.calls.payload.performed_at, fixedDate.toISOString());

  await assert.rejects(() => addProfessionalServiceToOrder({
    client: mock.client, organizationId: "", orderId: "order-1",
    service: { id: "s1", name: "Corte", price: 10 },
    professionalId: "p1", userId: "u1"
  }), { name: "TypeError" });

  await assert.rejects(() => addProfessionalServiceToOrder({
    client: mock.client, organizationId: "org-1", orderId: "order-1",
    service: { id: "s1", name: "Corte", price: -1 },
    professionalId: "p1", userId: "u1"
  }), { name: "TypeError" });


  // Preço ausente não pode ser convertido silenciosamente em serviço gratuito.
  for (const invalidPrice of [null, undefined, "", "  ", false, true, Infinity, NaN, 1e15]) {
    await assert.rejects(() => addProfessionalServiceToOrder({
      client: mock.client, organizationId: "org-1", orderId: "order-1",
      service: { id: "s1", name: "Corte", price: invalidPrice },
      professionalId: "p1", userId: "u1"
    }), { name: "TypeError" });
  }

  const failed = mockClient({ data: null, error: { message: "erro SQL privado" } });
  await assert.rejects(() => addProfessionalServiceToOrder({
    client: failed.client, organizationId: "org-1", orderId: "order-1",
    service: { id: "s1", name: "Corte", price: 10 },
    professionalId: "p1", userId: "u1"
  }), error => error.message.includes("Não foi possível registrar") && !error.message.includes("erro SQL"));

  process.stdout.write("Testes de inclusão de serviços em comandas aprovados.\n");
}

run().catch(error => {
  process.stderr.write("Falha nos testes de inclusão em comandas: " + error.message + "\n");
  process.exitCode = 1;
});
