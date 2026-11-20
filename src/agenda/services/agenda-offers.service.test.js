/** Testes de regressão do contrato entre Agenda, combos e lista de espera. */
import assert from "node:assert/strict";
import {
 validatePackageInput,mapAgendaOfferError,saveServicePackage,loadServicePackages,
 addAppointmentWaitlist,findAppointmentWaitlistOpenings,
 bookAppointmentFromWaitlist,listAppointmentWaitlist,setAppointmentWaitlistStatus
} from "./agenda-offers.service.js";
const org="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const customer="33333333-3333-4333-8333-333333333333";
const service="44444444-4444-4444-8444-444444444444";
const professional="55555555-5555-4555-8555-555555555555";
const wait="66666666-6666-4666-8666-666666666666";
const appointment="77777777-7777-4777-8777-777777777777";
const input={name:"Combo Corte + Escova",description:"Serviços em sequência",referencePrice:99.9,
 items:[{service_id:service,quantity:1,pause_after_minutes:15}]};
assert.equal(validatePackageInput(input).referencePrice,99.9);
assert.deepEqual(validatePackageInput(input).items,[{service_id:service,quantity:1,pause_after_minutes:15}]);
assert.throws(()=>validatePackageInput({...input,referencePrice:10.001}),/duas casas/);
assert.throws(()=>validatePackageInput({...input,items:[]}),/vinte serviços/);
assert.throws(()=>validatePackageInput({...input,items:[{service_id:service,quantity:0,pause_after_minutes:1}]}),/Confira serviço/);
assert.throws(()=>validatePackageInput({...input,items:[{service_id:service,quantity:1,pause_after_minutes:721}]}),/Confira serviço/);
assert.match(mapAgendaOfferError({code:"42501",message:"detalhes internos"}).message,/perfil/);
assert.match(mapAgendaOfferError({code:"23P01"}).message,/horário/);
const calls=[],db={
 service_packages:[{id:wait,name:"Combo",branch_id:branch,active:true}],
 service_package_items:[{id:professional,package_id:wait,service_id:service,sort_order:1,quantity:2,pause_after_minutes:0}],
};
const client={
 rpc:async(name,args)=>{calls.push({name,args});if(name==="list_appointment_waitlist")return {data:[],error:null};if(name==="find_appointment_waitlist_openings")return {data:[],error:null};if(name==="book_appointment_from_waitlist")return {data:appointment,error:null};return {data:wait,error:null};},
 from:table=>{
  const q={eq(){return q;},or(){return q;},in(){return q;},order(){return q;},
   range:async(from,to)=>({data:(db[table]||[]).slice(from,to+1),error:null})};
  return {select:()=>q};
 }
};
const opts={client,orgId:org,branchId:branch};
assert.equal(await saveServicePackage({...opts,...input}),wait);
assert.deepEqual(calls[0].args.p_items,[{service_id:service,quantity:1,pause_after_minutes:15}]);
const packages=await loadServicePackages(opts);
assert.equal(packages.length,1);
assert.equal(packages[0].items[0].service_id,service);
assert.deepEqual(await listAppointmentWaitlist(opts),[]);
assert.deepEqual(await findAppointmentWaitlistOpenings({...opts,date:"2026-11-25"}),[]);
assert.equal(await addAppointmentWaitlist({...opts,customerId:customer,serviceId:service,professionalId:professional,
 fromDate:"2026-11-25",untilDate:"2026-11-26",fromTime:"08:00",untilTime:"19:00"}),wait);
assert.equal(calls.at(-1).args.p_customer_id,customer);
await assert.rejects(()=>addAppointmentWaitlist({...opts,customerId:customer,serviceId:service,
 fromDate:"2026-02-30",untilDate:"2026-11-25",fromTime:"08:00",untilTime:"19:00"}),/Confira o cliente/);
const future=new Date(Date.now()+86400000).toISOString();
assert.equal(await bookAppointmentFromWaitlist({...opts,waitlistId:wait,professionalId:professional,startsAt:future}),appointment);
assert.equal(calls.at(-1).args.p_starts_at,future);
await assert.rejects(()=>bookAppointmentFromWaitlist({...opts,waitlistId:wait,professionalId:professional,
 startsAt:new Date(Date.now()-60000).toISOString()}),/futuro/);
assert.equal(await setAppointmentWaitlistStatus({...opts,waitlistId:wait,status:"contacted"}),wait);
await assert.rejects(()=>setAppointmentWaitlistStatus({...opts,waitlistId:wait,status:"booked"}),/alteração válida/);
console.log("Combos e lista de espera: contratos de serviço OK");
