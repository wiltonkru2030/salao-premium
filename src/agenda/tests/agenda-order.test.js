/**
 * Testes unitários da integração Agenda–Comanda, sem gravações reais.
 */
import assert from "node:assert/strict";
import {startAgendaOrder} from "../services/agenda-order.service.js";
let resolve;
const calls=[];
const client={rpc:(name,args)=>{calls.push([name,args]);return new Promise(r=>{resolve=r;});}};
const input={client,orgId:"org",appointment:{id:"a",appointment_group_id:"g"},existingId:"order",forceNew:true};
const first=startAgendaOrder(input);
await assert.rejects(()=>startAgendaOrder({...input,appointment:{id:"b",appointment_group_id:"g"}}),/andamento/);
assert.equal(calls.length,1);
assert.equal(calls[0][0],"start_appointment_group_service_order");
assert.equal(calls[0][1].p_force_new,false);
resolve({data:{order_number:1},error:null});
assert.equal((await first).order_number,1);
const second=startAgendaOrder({...input,appointment:{id:"a"}});
assert.equal(calls[1][0],"start_appointment_service_order");
resolve({data:null,error:new Error("falha")});
await assert.rejects(()=>second,/falha/);
const retry=startAgendaOrder({...input,appointment:{id:"a"}});
resolve({data:{order_number:2},error:null});
assert.equal((await retry).order_number,2);
console.log("Testes Agenda–Comanda: OK.");
