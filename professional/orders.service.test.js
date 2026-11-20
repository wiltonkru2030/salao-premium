/**
 * Testes dos serviços de leitura de comandas do App Profissional.
 *
 * Responsabilidade: validar filtros, escopo e mensagens seguras sem acessar rede/banco.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: executa contra orders.service.js com cliente Supabase simulado.
 */
import assert from "node:assert/strict";
import { fetchProfessionalOrders, fetchProfessionalOrderItems } from "./orders.service.js";

/**
 * Monta cliente Supabase falso e registra a consulta construída pelo serviço.
 * @param {object} response Resposta simulada do Supabase.
 * @returns {{client: object, calls: object}} Cliente e registro dos filtros.
 */
function mockClient(response) {
  const calls = { table: "", selection: "", filters: [], order: null, limit: null };
  const query = {
    select(value) { calls.selection = value; return this; },
    eq(...args) { calls.filters.push(args); return this; },
    order(...args) { calls.order = args; return this; },
    limit(value) { calls.limit = value; return Promise.resolve(response); }
  };
  return {
    calls,
    client: { from(table) { calls.table = table; return query; } }
  };
}

/** Executa os cenários principais e informa falhas ao processo de testes. */
async function run() {
  const orderRows = [{ id: "order-1" }];
  const orders = mockClient({ data: orderRows, error: null });
  assert.deepEqual(await fetchProfessionalOrders({
    client: orders.client, organizationId: "org-1"
  }), orderRows);
  assert.equal(orders.calls.table, "service_orders");
  assert.ok(orders.calls.filters.some(([field, value]) => field === "org_id" && value === "org-1"));
  assert.equal(orders.calls.limit, 100);

  const itemRows = [{ id: "item-1" }];
  const items = mockClient({ data: itemRows, error: null });
  assert.deepEqual(await fetchProfessionalOrderItems({
    client: items.client, organizationId: "org-1", orderId: "order-1"
  }), itemRows);
  assert.equal(items.calls.table, "service_order_items");
  assert.ok(items.calls.filters.some(([field, value]) => field === "org_id" && value === "org-1"));
  assert.ok(items.calls.filters.some(([field, value]) => field === "order_id" && value === "order-1"));

  const empty = mockClient({ data: null, error: null });
  assert.deepEqual(await fetchProfessionalOrders({
    client: empty.client, organizationId: "org-1"
  }), []);

  await assert.rejects(
    () => fetchProfessionalOrders({ client: orders.client, organizationId: "" }),
    { name: "TypeError" }
  );
  await assert.rejects(
    () => fetchProfessionalOrderItems({ client: items.client, organizationId: "org-1", orderId: "" }),
    { name: "TypeError" }
  );

  const failed = mockClient({ data: null, error: { message: "informação interna" } });
  await assert.rejects(
    () => fetchProfessionalOrders({ client: failed.client, organizationId: "org-1" }),
    error => error.message.includes("Não foi possível carregar") && !error.message.includes("informação interna")
  );

  process.stdout.write("Testes dos serviços de comandas aprovados.\n");
}

run().catch(error => {
  process.stderr.write("Falha nos testes dos serviços de comandas: " + error.message + "\n");
  process.exitCode = 1;
});
