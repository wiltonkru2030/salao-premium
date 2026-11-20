/**
 * Teste de regressão do contrato de filial da Agenda.
 * Responsabilidade: impedir que criações e alterações sejam enviadas sem branch_id.
 * Executar com: node src/agenda/tests/branch-scope.test.js
 */
import assert from "node:assert/strict";
import { createAppointment, updateAppointment, previewCreateAppointment } from "../services/agenda.service.js";

const orgId = "11111111-1111-4111-8111-111111111111";
const record = {
  id: "22222222-2222-4222-8222-222222222222",
  customer_id: "33333333-3333-4333-8333-333333333333",
  professional_id: "44444444-4444-4444-8444-444444444444",
  service_id: "55555555-5555-4555-8555-555555555555",
  customer_name: "Cliente de teste", service_name: "Corte",
  starts_at: "2030-01-15T14:00:00.000Z",
  ends_at: "2030-01-15T15:00:00.000Z", price: 100,
  status: "scheduled"
};
let writes = 0;
const client = {
  from(table) {
    assert.equal(table, "appointments");
    const query = {
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: record, error: null }),
      insert() { writes++; throw new Error("Gravação inesperada"); },
      update() { writes++; throw new Error("Gravação inesperada"); }
    };
    return query;
  }
};

await assert.rejects(
  createAppointment(record, { client, orgId }),
  /Selecione a unidade do salão antes de agendar/
);
await assert.rejects(
  updateAppointment(record.id, { notes: "Atualização" }, { client, orgId }),
  /Selecione a unidade do salão antes de agendar/
);
assert.equal(writes, 0, "Nenhuma gravação pode ocorrer sem filial");

// Com filial, a prévia deve incluir o identificador na gravação preparada.
// O mock implementa paginação sem depender de conexão real com o banco.
const branchId = "66666666-6666-4666-8666-666666666666";
const paginatedClient = {
  from(table) {
    assert.equal(table, "appointments");
    const query = {
      select() { return this; }, eq() { return this; },
      gte() { return this; }, lt() { return this; },
      order() { return this; },
      async range() { return { data: [], error: null }; }
    };
    return query;
  }
};
const preview = await previewCreateAppointment(
  { ...record, branch_id: branchId },
  { client: paginatedClient, orgId }
);
assert.equal(preview.preview.branch_id, branchId, "A filial precisa chegar ao payload de persistência");
// A escrita real precisa receber branch_id em INSERT e UPDATE, não só na prévia.
const writesWithBranch = [];
const writeClient = {
  from(table) {
    assert.equal(table, "appointments");
    const query = {
      select() { return this; }, eq() { return this; },
      gte() { return this; }, lt() { return this; },
      order() { return this; },
      async range() { return { data: [], error: null }; },
      async maybeSingle() { return { data: { ...record, branch_id: branchId }, error: null }; },
      insert(payload) { writesWithBranch.push(["insert", payload]); return this; },
      update(payload) { writesWithBranch.push(["update", payload]); return this; },
      single: async () => ({ data: { ...record, branch_id: branchId }, error: null })
    };
    return query;
  }
};
const creation = await createAppointment(
  { ...record, branch_id: branchId }, { client: writeClient, orgId }
);
assert.equal(creation.ok, true);
const edition = await updateAppointment(record.id, { notes: "Revisão" }, { client: writeClient, orgId });
assert.equal(edition.ok, true);
assert.deepEqual(writesWithBranch.map(([method, payload]) => [method, payload.branch_id]), [
  ["insert", branchId], ["update", branchId]
]);
console.log("Agenda: filial obrigatória preservada na prévia, criação e edição.");
