/** Testes dos contratos de pagamento e cancelamento da Comanda com cliente Supabase simulado. */
import assert from "node:assert/strict";
import { registerComandaPayment, cancelComanda } from "./services/comanda-operations.js";

const calls=[];
const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true},error:null};}};
await registerComandaPayment({supabase,orderId:"order-1",amount:25.5,paymentMethod:"pix"});
assert.equal(calls[0].name,"register_service_order_payment");
assert.equal(calls[0].args.p_amount,25.5);
await cancelComanda({supabase,orderId:"order-1",refundPayments:true});
assert.equal(calls[1].name,"cancel_service_order");
assert.equal(calls[1].args.p_refund_payments,true);
await assert.rejects(()=>registerComandaPayment({supabase,orderId:"order-1",amount:0,paymentMethod:"pix"}),/valor de pagamento válido/);
// Valores fracionários de centavo devem falhar antes de chamar a API.
const previousCalls=calls.length;
for(const amount of ["10.001",0.009,NaN,Infinity,-1]) {
  await assert.rejects(()=>registerComandaPayment({supabase,orderId:"order-1",amount,paymentMethod:"pix"}));
}
assert.equal(calls.length,previousCalls);
await registerComandaPayment({supabase,orderId:"order-1",amount:"0.29",paymentMethod:"cash"});
assert.equal(calls.at(-1).args.p_amount,0.29);

await assert.rejects(()=>registerComandaPayment({supabase,orderId:"order-1",amount:10,paymentMethod:"invalid"}),/forma de pagamento válida/);
await assert.rejects(()=>cancelComanda({supabase,orderId:""}),/Comanda não identificada/);

process.stdout.write("Testes das operações da Comanda: OK\n");

// Contrato novo é explícito; repetir o mesmo identificador não muda os argumentos.
const requestId="36af1ae2-f6b5-4cc3-a795-c9e5de1c3b31";
await registerComandaPayment({supabase,orderId:"order-1",amount:25,paymentMethod:"pix",requestId});
await registerComandaPayment({supabase,orderId:"order-1",amount:25,paymentMethod:"pix",requestId});
assert.equal(calls.at(-1).name,"register_service_order_payment_once");
assert.equal(calls.at(-1).args.p_request_id,requestId);
assert.deepEqual(calls.at(-1),calls.at(-2));
await assert.rejects(()=>registerComandaPayment({supabase,orderId:"order-1",amount:25,paymentMethod:"pix",requestId:"invalid"}),/Identificador/);
let attempts=0;
const unavailable={rpc:async(name)=>{attempts++;assert.equal(name,"register_service_order_payment_once");return {error:{message:"Falha de conexão"}};}};
const failed=await registerComandaPayment({supabase:unavailable,orderId:"order-1",amount:25,paymentMethod:"pix",requestId});
assert.ok(failed.error);assert.equal(attempts,1);
