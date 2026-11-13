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
await assert.rejects(()=>registerComandaPayment({supabase,orderId:"order-1",amount:10,paymentMethod:"invalid"}),/forma de pagamento válida/);
await assert.rejects(()=>cancelComanda({supabase,orderId:""}),/Comanda não identificada/);

process.stdout.write("Testes das operações da Comanda: OK\n");
