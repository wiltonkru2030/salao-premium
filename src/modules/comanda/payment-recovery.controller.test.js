/** Simula a resposta perdida e reabertura; verifica o contrato do controlador real. */
import assert from "node:assert/strict";
import {bindComandaDetails} from "./controllers/comanda-detail.controller.js";
import {createPaymentIntentStore} from "./services/payment-intent.js";
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const memory=new Map();
const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const config={storage,organizationId:id(1),userId:id(2),orderId:id(3),makeId:()=>id(4)};
const calls=[],messages=[];let refreshes=0;let response={error:{code:"NETWORK_ERROR",message:"Resposta perdida"}};
const originalFormData=globalThis.FormData,originalWindow=globalThis.window;
globalThis.FormData=class {get(name){return {amount:"25,00",payment_method:"pix"}[name];}};
globalThis.window={confirm:()=>true};
function button(){return {disabled:false,isConnected:true,textContent:"Registrar pagamento",addEventListener(event,fn){this[event]=fn;}};}
function setup({pending=null,user=id(2)}={}){
 const paymentStore=createPaymentIntentStore(config),control=button();
 const form={querySelector:()=>control,reportValidity:()=>true,addEventListener(event,fn){this[event]=fn;}};
 const host={querySelector(selector){return selector==="#comanda-payment-form"&&!pending?form:selector==="#comanda-payment-retry"&&pending?control:null;}};
 bindComandaDetails({host,order:{id:id(3)},orgId:id(1),supabase:{rpc:async(name,args)=>{calls.push({name,args});return response;}},tenant:async()=>({user:{id:user},orgId:id(1)}),toast:m=>messages.push(m),reportError:()=>{},refresh:async()=>refreshes++,isCurrent:()=>true,editable:!pending,allowEdit:false,allowPay:true,canEditItems:false,canAddOwnService:false,isProfessional:false,professionals:[],paymentStore,pendingPayment:pending,protectedPayments:true,withPaymentLock:task=>task()});
 return {paymentStore,control,form};
}
try{
 const first=setup();
 await first.form.submit({preventDefault(){},currentTarget:first.form});
 assert.equal(calls.length,1);assert.equal(calls[0].name,"register_service_order_payment_once");assert.equal(first.control.disabled,true);
 assert.equal(first.paymentStore.read().requestId,id(4));assert.equal(refreshes,1);
 const existing=first.paymentStore.read();
 response={data:{payment_id:id(5),replayed:true,closed:true},error:null};
 const reopened=setup({pending:existing});
 await reopened.control.click();
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(reopened.paymentStore.read(),null);assert.equal(refreshes,2);
 assert.ok(messages.some(m=>m.includes("anterior localizado")));
 const wrong=setup({user:id(9)});await wrong.form.submit({preventDefault(){},currentTarget:wrong.form});
 assert.equal(calls.length,2);assert.equal(wrong.paymentStore.read(),null);
 response={error:{code:"22023",message:"Valor inválido"}};
 const rejected=setup();await rejected.form.submit({preventDefault(){},currentTarget:rejected.form});
 assert.equal(calls.length,3);assert.equal(rejected.paymentStore.read(),null);
 response={error:{code:"NETWORK_ERROR",message:"Resposta perdida"}};
 const uncertain=setup();await uncertain.form.submit({preventDefault(){},currentTarget:uncertain.form});
 response={error:{code:"42501",message:"Permissão alterada"}};
 const later=setup({pending:uncertain.paymentStore.read()});await later.control.click();
 assert.equal(later.paymentStore.read().requestId,id(4));
 console.log("Recuperação do recebimento no controlador: OK");
}finally{globalThis.FormData=originalFormData;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
