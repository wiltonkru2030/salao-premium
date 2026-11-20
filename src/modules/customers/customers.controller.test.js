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
const snapshot={customers:[{id:"c1",active:true}]};
const options={host,client:{},customerPageState:{
  current:()=>current?snapshot:null,isCurrent:()=>current
},customerContextKey:()=>"context",getContext:()=>({orgId:"org-a",branchId:"branch-a"}),
canManageCustomers:()=>authorized,toast:()=>{},reportError:error=>errors.push(error),
saveCustomer:async()=>{},setCustomerActive:async input=>{calls.push(input);if(failure)throw new Error("Falha");},
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
console.log("Testes do controlador de clientes: OK.");
