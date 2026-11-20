/**
 * Testes unitários dos formatadores do App Profissional.
 * Responsabilidade: validar conversões e rótulos sem iniciar o PWA ou acessar o Supabase.
 * Execução: node professional/utils/formatters.test.js
 */
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatMoney,
  toDateKey,
  formatMonthLabel,
  formatDateLabel,
  formatTime,
  formatDateTime,
  formatBookingSource,
  formatStatus,
  getAppointmentClass
} from "./formatters.js";

assert.equal(escapeHtml(`<script>"&'</script>`), "&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;");
assert.equal(formatMoney(12.5), (12.5).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
assert.equal(formatMoney(Number.NaN), "R$ —");
assert.equal(formatMoney(null), "R$ —");
assert.equal(formatMoney(undefined), "R$ —");
assert.equal(formatMoney(""), "R$ —");
assert.equal(formatMoney(0), (0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
assert.equal(toDateKey(new Date(2026, 10, 19)), "2026-11-19");
assert.equal(toDateKey(new Date("data inválida")), "");
assert.match(formatMonthLabel(new Date(2026, 10, 19)), /novembro de 2026/i);
assert.match(formatDateLabel(new Date(2026, 10, 19)), /19 de novembro/i);
assert.match(formatTime("2026-11-19T14:30:00-03:00"), /^14:30$/);
assert.equal(formatTime("data inválida"), "—");
assert.notEqual(formatDateTime("2026-11-19T14:30:00-03:00"), "—");
assert.equal(formatBookingSource("customer"), "Cliente");
assert.equal(formatBookingSource("unknown"), "Salão");
assert.equal(formatStatus("partially_paid"), "Pagamento parcial");
assert.equal(formatStatus(""), "—");
assert.equal(getAppointmentClass({ status: "in_progress" }), "progress");
assert.equal(getAppointmentClass({ status: "confirmed" }), "success");
assert.equal(getAppointmentClass({ status: "no_show" }), "released");
assert.equal(getAppointmentClass({ status: "scheduled" }), "scheduled");

console.log("Testes dos formatadores do App Profissional concluídos.");
