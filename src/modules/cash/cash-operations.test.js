/** Testes dos contratos de abertura e fechamento do Caixa com cliente Supabase simulado. */
import assert from "node:assert/strict";
import { openCashRegister, closeCashRegister } from "./services/cash-operations.js";

const calls=[];
const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true},error:null};}};
await openCashRegister({supabase,orgId:"org-1",openingAmount:"100.50"});
assert.equal(calls[0].name,"open_cash_register");
assert.equal(calls[0].args.p_opening_amount,100.5);
await closeCashRegister({supabase,cashRegisterId:"cash-1",closingAmount:"130"});
assert.equal(calls[1].name,"close_cash_register");
assert.equal(calls[1].args.p_closing_amount,130);
await assert.rejects(()=>openCashRegister({supabase,orgId:"org-1",openingAmount:-1}),/valor inicial válido/);
await assert.rejects(()=>closeCashRegister({supabase,cashRegisterId:"",closingAmount:20}),/caixa aberto/);

process.stdout.write("Testes das operações do Caixa: OK\n");
