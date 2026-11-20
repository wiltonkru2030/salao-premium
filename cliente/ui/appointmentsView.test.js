/**
 * Testes de renderização da tela de agendamentos da cliente.
 * Responsabilidade: verificar estados e escape de conteúdo retornado pelo backend.
 */
import assert from "node:assert/strict";
import { renderAppointmentsView } from "./appointmentsView.js";

assert.ok(renderAppointmentsView({ loading: true }).includes("Carregando seus agendamentos"));
assert.ok(renderAppointmentsView({ appointments: [] }).includes("Nenhum agendamento encontrado"));
assert.ok(renderAppointmentsView({ error: "Falha <script>" }).includes("Falha &lt;script&gt;"));
const html = renderAppointmentsView({
  appointments: [{
    appointment_id: "a1",
    salon_name: "<img src=x>",
    branch_name: "Centro",
    service_name: "Corte",
    professional_name: "Ana",
    starts_at: "2026-12-01T15:00:00Z",
    status: "confirmed",
    price: 80
  }]
});
assert.ok(html.includes("Confirmado"));
assert.ok(html.includes("&lt;img src=x&gt;"));
assert.ok(!html.includes("<img src=x>"));
assert.ok(html.includes("Corte"));
console.log("Testes da tela de agendamentos da cliente: OK");
