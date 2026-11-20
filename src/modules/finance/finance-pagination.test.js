/** Testes de centavos, paginação e falha sem totais parciais. */
import assert from "node:assert/strict";
import {readFinancePages,sumFinanceAmounts} from "./finance-pagination.js";
const data=Array.from({length:503},(_,i)=>({id:String(i),amount:0.01}));
const ranges=[];
const result=await readFinancePages(()=>({range:async(start,end)=>{ranges.push([start,end]);return {data:data.slice(start,end+1),error:null};}}),250);
assert.deepEqual(ranges,[[0,249],[250,499],[500,749]]);
assert.equal(result.length,503);
assert.equal(sumFinanceAmounts(result),5.03);
assert.equal(sumFinanceAmounts([{amount:0.1},{amount:0.2}]),0.3);
assert.equal(sumFinanceAmounts([{amount:100},{amount:-40}]),60);
assert.throws(()=>sumFinanceAmounts([{amount:0.001}]),/Valor financeiro inválido/);
assert.throws(()=>sumFinanceAmounts([{amount:null}]),/Valor financeiro inválido/);
assert.throws(()=>sumFinanceAmounts([{amount:Infinity}]),/Valor financeiro inválido/);
await assert.rejects(()=>readFinancePages(()=>({range:async()=>({data:[{id:"1"},{id:"1"}]})}),2),/mudaram durante/);
await assert.rejects(()=>readFinancePages(()=>({range:async(start)=>start===0?{data:[{id:"1"}]}:{error:new Error("segunda página")}}),1),/segunda página/);
console.log("Paginação e precisão financeiras: OK");
