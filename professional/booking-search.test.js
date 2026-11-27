/** Testes puros de pesquisa, formulário e contrato de agendamento, sem conexão real. */
import assert from "node:assert/strict";
import {searchBookingClients,applyBookingSlots} from "./booking-search.js";
import {renderProfessionalBooking} from "./views/booking.views.js";
import {createUnitAppointment} from "./appointments.service.js";
const clients=[{id:"1",name:"Júlia",phone:"(67) 99999-1234"},{id:"2",name:"Ana",phone:"67988888888"}];
assert.deepEqual(searchBookingClients(clients,"julia").map(c=>c.id),["1"]);
assert.deepEqual(searchBookingClients(clients,"1234").map(c=>c.id),["1"]);
assert.match(renderProfessionalBooking({unitBooking:true}),/professional-booking-quick-customer/);
assert.doesNotMatch(renderProfessionalBooking(),/professional-booking-quick-customer/);
assert.doesNotMatch(renderProfessionalBooking({unitBooking:true}),/type="date"/);
let call;
const client={rpc:async(name,args)=>{call={name,args};return {data:{id:"a",starts_at:"2026-12-01T12:00:00Z"}};}};
const opts={client,organizationId:"org",customerId:"1",service:"s",localStart:"2026-12-01T09:00"};
await createUnitAppointment(opts);
assert.equal(call.name,"create_professional_unit_appointment");
assert.equal(call.args.target_customer,"1");
assert.equal(call.args.local_start,opts.localStart);
await assert.rejects(()=>createUnitAppointment({...opts,client:{rpc:async()=>({error:{code:"23P01"}})}}),/ocupado/);
console.log("Busca e agendamento por cliente: OK");

// Regressão: sugestões válidas são apresentadas e não travam o horário manual.
const suggestions={disabled:true,options:[],ownerDocument:{createElement:()=>({})},replaceChildren(...options){this.options=options;}};
const slotStatus={textContent:""};
applyBookingSlots({suggestions,slotStatus,result:{reason:"available",slots:["13:05","12:40","13:05","24:00","12:60","invalid"]}});
assert.deepEqual(suggestions.options.map(o=>o.value),["","12:40","13:05"]);
assert.equal(suggestions.disabled,false);
assert.doesNotMatch(suggestions.options[0].textContent,/Consultando/);
applyBookingSlots({suggestions,slotStatus,result:{reason:"professional_closed",slots:[]}});
assert.equal(suggestions.disabled,true);
assert.match(slotStatus.textContent,/Meu expediente/);
applyBookingSlots({suggestions,slotStatus,result:{reason:"available",slots:["inválido"]}});
assert.equal(suggestions.disabled,true);
assert.match(slotStatus.textContent,/interpretar/);
const markup=renderProfessionalBooking({unitBooking:true,availableSlots:true});
assert.match(markup,/<input name="start" type="time" step="60" required>/);
assert.match(markup,/<select data-booking-suggestions disabled>/);
assert.doesNotMatch(markup,/<input name="start"[^>]*disabled/);
console.log("Horário manual e sugestões: regressão aprovada.");

// Cadastro rápido existe, mas seu atalho só é renderizado pelo resultado vazio da busca.
assert.doesNotMatch(markup,/data-booking-quick-open/);
assert.match(markup,/booking-search-field/);
