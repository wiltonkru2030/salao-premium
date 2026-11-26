/**
 * Testes das regras puras do calendário mensal do App Profissional.
 * Execução: node professional/utils/agenda-rules.test.js
 */
import assert from "node:assert/strict";
import { buildMonthlyCalendar } from "./agenda-rules.js";

const result = buildMonthlyCalendar({
  month: new Date(2026, 10, 1), selectedDate: new Date(2026, 10, 20), today: new Date(2026, 10, 20),
  appointments: [{ id: "b", starts_at: "2026-11-20T14:00:00" }, { id: "a", starts_at: "2026-11-20T09:00:00" }, { id: "other", starts_at: "2026-11-21T09:00:00" }]
});
assert.equal(result.cells.length, 42);
assert.equal(result.cells.filter(cell => cell.inMonth).length, 30);
assert.equal(result.cells.find(cell => cell.key === "2026-11-20").selected, true);
assert.equal(result.cells.find(cell => cell.key === "2026-11-20").today, true);
assert.equal(result.cells.find(cell => cell.key === "2026-11-20").hasAppointments, true);
assert.deepEqual(result.selectedAppointments.map(item => item.id), ["a", "b"]);
const leap = buildMonthlyCalendar({ month: new Date(2024, 1, 1), selectedDate: new Date(2024, 1, 29), today: new Date(2024, 1, 1) });
assert.equal(leap.cells.filter(cell => cell.inMonth).length, 29);
assert.throws(() => buildMonthlyCalendar({ month: "2026-11", selectedDate: new Date() }), /mês informado é inválido/);
assert.throws(() => buildMonthlyCalendar({ month: new Date(), selectedDate: new Date(), appointments: {} }), /lista de agendamentos é inválida/);
console.log("Testes das regras do calendário mensal: OK");

// Em Manaus, um instante no início de dezembro UTC ainda pertence a novembro.
const salonCalendar = buildMonthlyCalendar({
  month:new Date(2026,10,1),selectedDate:new Date(2026,10,30),
  timezone:"America/Manaus",appointments:[{id:"late",starts_at:"2026-12-01T02:00:00Z"}]
});
assert.deepEqual(salonCalendar.selectedAppointments.map(item=>item.id),["late"]);

// O mesmo dia pode apresentar os três estados, sem duplicar riscos.
const mixedDay = buildMonthlyCalendar({month:new Date(2026,10,1),selectedDate:new Date(2026,10,20),
  appointments:["confirmed","completed","cancelled","confirmed"].map(status=>({status,starts_at:new Date(2026,10,20,12).toISOString()}))
});
assert.deepEqual([...mixedDay.cells.find(cell=>cell.key==="2026-11-20").statuses],["confirmed","completed","cancelled"]);
assert.equal(mixedDay.cells.find(cell=>cell.key==="2026-11-21").statuses.size,0);
