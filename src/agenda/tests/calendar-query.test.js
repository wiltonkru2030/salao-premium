/**
 * Testa o contrato de leitura do calendário e o escopo por filial.
 * Cliente simulado exclusivamente para testes unitários.
 */
import assert from "node:assert/strict";
import {fetchAgendaCalendar} from "../services/calendar-query.service.js";
const calls=[];
const client={from(table){
 const q={then(resolve,reject){return Promise.resolve({data:[{id:table}],error:null}).then(resolve,reject);}};
 for(const method of ["select","eq","lt","gt","gte","order","range","limit"])q[method]=(...args)=>{calls.push([table,method,...args]);return q;};
 return q;
}};
const input={client,orgId:"org",branchId:"branch",start:new Date("2026-11-20T00:00:00Z"),end:new Date("2026-11-21T00:00:00Z")};
const result=await fetchAgendaCalendar(input);
assert.equal(result.appointments[0].id,"appointments");
assert.equal(result.professionals[0].id,"professionals");
assert.equal(result.blocks[0].id,"appointment_blocks");
for(const table of ["appointments","professionals","appointment_blocks"]){
 assert.ok(calls.some(c=>c.join("|")===[table,"eq","org_id","org"].join("|")));
 assert.ok(calls.some(c=>c.join("|")===[table,"eq","branch_id","branch"].join("|")));
}
await assert.rejects(()=>fetchAgendaCalendar({...input,orgId:""}),TypeError);
await assert.rejects(()=>fetchAgendaCalendar({...input,end:input.start}),TypeError);
console.log("Testes de consulta do calendário: OK.");
