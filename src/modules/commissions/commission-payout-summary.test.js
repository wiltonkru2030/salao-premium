/** Testes unitários da prévia de repasse, sem acesso ao banco. */
import assert from "node:assert/strict";
import { summarizeCommissionPayout } from "./commission-payout-summary.js";
const row=(id,amount,overrides={})=>({id,amount,professional_id:"p1",status:"pending",...overrides});
const rows=[row("a",100),row("b",-40),row("c",-500,{professional_id:"p2"}),row("d",-200,{status:"paid"}),row("e",30),row("f",-15,{payout_id:"paid"})];
assert.deepEqual(summarizeCommissionPayout({rows,professionalId:"p1",selectedIds:["a"]}),{credit:100,debit:40,net:60});
assert.deepEqual(summarizeCommissionPayout({rows,professionalId:"p1",selectedIds:["e"]}),{credit:30,debit:40,net:-10});
assert.deepEqual(summarizeCommissionPayout({rows:[row("x",0.1),row("y",0.2),row("z",-0.03)],professionalId:"p1",selectedIds:["x","y"]}),{credit:0.3,debit:0.03,net:0.27});
assert.throws(()=>summarizeCommissionPayout({rows,professionalId:"p1",selectedIds:["b"]}),/não está disponível/);
assert.throws(()=>summarizeCommissionPayout({rows,professionalId:"p1",selectedIds:["a","a"]}),/repetidas/);
console.log("Prévia de repasse líquido: OK");
