/**
 * Testes do catálogo público e formulário de disponibilidade.
 * Responsabilidade: validar escape, profissionais e horários.
 */
import assert from "node:assert/strict";
import { renderSalonDetailView } from "./salonDetailView.js";

assert.ok(renderSalonDetailView({ loading: true }).includes("Carregando catálogo"));
assert.ok(renderSalonDetailView({ error: "Falha <script>" }).includes("Falha &lt;script&gt;"));
const html = renderSalonDetailView({
  salon: { display_name: "Studio" },
  catalog: [{
    service_id: "service-1", service_name: "<img src=x>", category: "Cabelo",
    duration_minutes: 60, price: 90, professional_id: "professional-1", professional_name: "Ana"
  }],
  slots: { serviceId: "service-1", items: [{starts_at:"2026-12-01T12:00:00Z",professional_name:"Ana"}] }
});
assert.ok(html.includes("&lt;img src=x&gt;"));
assert.ok(!html.includes("<img src=x>"));
assert.ok(html.includes("Qualquer profissional"));
assert.ok(html.includes('data-action="create-hold"'));
console.log("Testes do detalhe público do salão: OK");
