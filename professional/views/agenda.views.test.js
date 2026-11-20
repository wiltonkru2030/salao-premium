/**
 * Testes unitários da view de agenda do App Profissional.
 * Responsabilidade: verificar calendário, seleção de data e estado vazio sem iniciar a aplicação.
 * Execução: node professional/views/agenda.views.test.js
 */
import assert from "node:assert/strict";
import { renderAgendaView } from "./agenda.views.js";

const selectedDate = new Date(2026, 10, 20);
const state = { month: new Date(2026, 10, 1), selectedDate, appointments: [], scope: "self" };
const html = renderAgendaView({
  state,
  dateKey: date => date instanceof Date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}` : "",
  monthLabel: () => "novembro de 2026",
  dateLabel: () => "20 de novembro",
  appointmentCard: () => "",
  appointmentDetails: () => ""
});
assert.match(html, /Agenda mensal/);
assert.match(html, /novembro de 2026/);
assert.match(html, /Nenhum agendamento neste dia/);
assert.match(html, /data-date="2026-11-20"/);
assert.match(html, /Somente sua agenda/);

console.log("Testes da view de agenda do App Profissional concluídos.");
