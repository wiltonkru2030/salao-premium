/**
 * Testes do controlador de produtos: autorização, concorrência e recuperação de erros.
 * Usa serviços simulados exclusivamente no ambiente de testes.
 */
import assert from "node:assert/strict";
import { bindProductEvents } from "./products.controller.js";
const handlers={};
const host={dataset:{},addEventListener(type,fn){handlers[type]=fn;}};
globalThis.document={addEventListener(){}};
globalThis.window={confirm:()=>true};
const snapshot={orgId:"org-a",rows:[{id:"p1",active:true}],pending:false};
let authorized=true,current=true,failure=false,reloads=0;
const calls=[],errors=[];
bindProductEvents({
 host,client:{},productPageState:{current:()=>current?snapshot:null,isCurrent:()=>current},
 getOrgId:()=>"org-a",canManageProducts:()=>authorized,toast:()=>{},
 reportError:error=>errors.push(error),saveProduct:async()=>{},
 setProductActive:async data=>{calls.push(data);if(failure)throw new Error("Falha");},
 loadProductsPage:async()=>{reloads++;}
});
const toggle={dataset:{toggleProduct:"p1"},disabled:false,isConnected:true};
const event={target:{closest:s=>s==="[data-toggle-product]"?toggle:null}};
authorized=false;await handlers.click(event);assert.equal(calls.length,0);
authorized=true;current=false;await handlers.click(event);assert.equal(calls.length,0);
current=true;snapshot.pending=true;await handlers.click(event);assert.equal(calls.length,0);
snapshot.pending=false;await handlers.click(event);
assert.equal(calls[0].orgId,"org-a");assert.equal(calls[0].active,false);
assert.equal(reloads,1);assert.equal(snapshot.pending,false);
failure=true;await handlers.click(event);assert.equal(errors.length,1);
assert.equal(toggle.disabled,false);assert.equal(snapshot.pending,false);assert.equal(reloads,1);
console.log("Testes do controlador de produtos: OK.");
