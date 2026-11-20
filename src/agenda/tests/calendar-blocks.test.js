/**
 * Testa bloqueios de calendário em horários locais, sem conexão ao banco.
 */
import assert from "node:assert/strict";
import {expandCalendarBlocks} from "../utils/calendar-blocks.js";
const date=(d,h=0)=>new Date(2026,10,d,h);
const professionals=[{id:"p1"},{id:"p2"}];
const block={id:"b",starts_at:date(19,18).toISOString(),ends_at:date(22,10).toISOString(),reason:"Folga"};
const rows=expandCalendarBlocks([block],professionals,date(20),date(23));
assert.equal(rows.length,6);
assert.deepEqual(rows.filter(x=>x.pro===0).map(x=>[x.date,x.start,x.end]),[["2026-11-20","00:00","24:00"],["2026-11-21","00:00","24:00"],["2026-11-22","00:00","10:00"]]);
assert.equal(expandCalendarBlocks([{...block,professional_id:"p2"}],professionals,date(20),date(23)).length,3);
assert.equal(expandCalendarBlocks([block],professionals,date(23),date(24)).length,0);
console.log("Testes de bloqueios do calendário: OK.");
