/**
 * Testes do controlador de serviços: autorização, concorrência e recuperação de erros.
 * Usa serviços simulados exclusivamente no ambiente de testes.
 */
import assert from "node:assert/strict";
import { bindServiceEvents } from "./services.controller.js";
const handlers={};
const host={dataset:{},addEventListener(type,fn){handlers[type]=fn;}};
globalThis.document={addEventListener(){}};
globalThis.window={confirm:()=>true};
const snapshot={orgId:"org-a",rows:[{id:"p1",active:true}],pending:false};
let authorized=true,current=true,failure=false,reloads=0;
const calls=[],errors=[];
bindServiceEvents({
 host,client:{},servicePageState:{current:()=>current?snapshot:null,isCurrent:()=>current},
 getOrgId:()=>"org-a",canManageServices:()=>authorized,toast:()=>{},
 reportError:error=>errors.push(error),saveService:async()=>{},
 setServiceActive:async data=>{calls.push(data);if(failure)throw new Error("Falha");},
 loadServicesPage:async()=>{reloads++;}
});
const toggle={dataset:{toggleService:"p1"},disabled:false,isConnected:true};
const event={target:{closest:s=>s==="[data-toggle-service]"?toggle:null}};
authorized=false;await handlers.click(event);assert.equal(calls.length,0);
authorized=true;current=false;await handlers.click(event);assert.equal(calls.length,0);
current=true;snapshot.pending=true;await handlers.click(event);assert.equal(calls.length,0);
snapshot.pending=false;await handlers.click(event);
assert.equal(calls[0].orgId,"org-a");assert.equal(calls[0].active,false);
assert.equal(reloads,1);assert.equal(snapshot.pending,false);
failure=true;await handlers.click(event);assert.equal(errors.length,1);
assert.equal(toggle.disabled,false);assert.equal(snapshot.pending,false);assert.equal(reloads,1);
console.log("Testes do controlador de serviços: OK.");
