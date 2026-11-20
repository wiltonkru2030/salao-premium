/**
 * Testes dos eventos da carteira de clientes.
 * Simula a montagem e verifica autorização, contexto, bloqueio e falhas.
 */
import assert from "node:assert/strict";
import { bindCustomerEvents } from "./customers.controller.js";
const listeners={};
const host={dataset:{},addEventListener(type,fn){listeners[type]=fn;}};
globalThis.document={addEventListener(){}};
globalThis.window={confirm:()=>true};
let authorized=true, current=true, failure=false, calls=[], errors=[], reloads=0;
const saves=[];
const snapshot={customers:[{id:"c1",active:true}]};
const options={host,client:{},customerPageState:{
  current:()=>current?snapshot:null,isCurrent:()=>current
},customerContextKey:()=>"context",getContext:()=>({orgId:"org-a",branchId:"branch-a"}),
canManageCustomers:()=>authorized,toast:()=>{},reportError:error=>errors.push(error),
saveCustomer:async input=>{saves.push(input);if(failure)throw new Error("Falha ao salvar");},setCustomerActive:async input=>{calls.push(input);if(failure)throw new Error("Falha");},
loadCustomersPage:async()=>{reloads++;}};
bindCustomerEvents(options);
const click=listeners.click;
bindCustomerEvents(options);
assert.equal(listeners.click,click);
const toggle={dataset:{toggleCustomer:"c1"},disabled:false,isConnected:true};
const event={target:{closest:selector=>selector==="[data-toggle-customer]"?toggle:null}};
authorized=false;
await click(event);
assert.equal(calls.length,0);
authorized=true;
current=false;
await click(event);
assert.equal(calls.length,0);
current=true;
toggle.disabled=true;
await click(event);
assert.equal(calls.length,0);
toggle.disabled=false;
await click(event);
assert.equal(calls[0].orgId,"org-a");
assert.equal(calls[0].customerId,"c1");
assert.equal(calls[0].active,false);
assert.equal(reloads,1);
assert.equal(toggle.disabled,false);
failure=true;
await click(event);
assert.equal(errors.length,1);
assert.equal(toggle.disabled,false);
assert.equal(reloads,1);
// Exercita a submissão sem depender de um navegador ou banco de produção.
const NativeFormData=globalThis.FormData;
const fields={customer_id:"",name:"Cliente Teste",phone:"11999999999",email:"",birth_date:""};
globalThis.FormData=class {get(key){return fields[key];}};
const submit={disabled:false,isConnected:true};
const form={matches:()=>true,querySelector:()=>submit};
host.querySelector=()=>({close(){}});
const submitEvent={target:form,preventDefault(){}};
try {
  failure=false;
  await listeners.submit(submitEvent);
  assert.equal(saves.length,1);
  assert.equal(saves[0].branchId,"branch-a");
  assert.equal(saves[0].name,"Cliente Teste");
  assert.equal(submit.disabled,false);
  fields.customer_id="inexistente";
  await listeners.submit(submitEvent);
  assert.equal(saves.length,1);
  fields.customer_id="c1";
  failure=true;
  await listeners.submit(submitEvent);
  assert.equal(saves[1].customerId,"c1");
  assert.equal(errors.length,2);
  assert.equal(submit.disabled,false);
  current=false;
  await listeners.submit(submitEvent);
  assert.equal(saves.length,2);
} finally {
  globalThis.FormData=NativeFormData;
}
console.log("Testes do controlador de clientes: OK.");
