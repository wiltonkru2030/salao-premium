/**
 * Testes do serviço financeiro.
 * Responsabilidade: validar período, tenant e separação entre caixa e despesas.
 */
import assert from "node:assert/strict";
import {fetchFinanceWorkspace} from "./finance.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],limit:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      gte(key,value){call.filters.push([key,">=",value]);return query;},
      lt(key,value){call.filters.push([key,"<",value]);return query;},
      order(key,options){call.order=[key,options];return query;},
      range(from,to){call.range=[from,to];return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        return Promise.resolve({data:(tables[table]||[]).slice(call.range?.[0]||0,(call.range?.[1]??499)+1),error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
}
async function run(){
  const client=mockClient({
    cash_movements:[{id:"m1",org_id:"org-a",movement_type:"income",amount:100}],
    expenses:[{id:"e1",org_id:"org-a",status:"pending",amount:50}]
  });
  const result=await fetchFinanceWorkspace({
    client,orgId:"org-a",startIso:"2026-11-01T00:00:00.000Z",endIso:"2026-12-01T00:00:00.000Z"
  });
  assert.equal(result.movements.length,1);
  assert.equal(result.expenses.length,1);
  assert.equal(client.calls.length,2);
  assert.ok(client.calls.every(call=>call.filters.some(([key,value])=>key==="org_id"&&value==="org-a")));
  assert.ok(client.calls.find(call=>call.table==="cash_movements").filters.some(([key,op])=>key==="created_at"&&op===">="));
  const large=mockClient({cash_movements:Array.from({length:501},(_,i)=>({id:"m"+i,amount:1})),expenses:[]});
  const all=await fetchFinanceWorkspace({client:large,orgId:"org-a",startIso:"2026-11-01",endIso:"2026-12-01"});
  assert.equal(all.movements.length,501);
  assert.deepEqual(large.calls.filter(c=>c.table==="cash_movements").map(c=>c.range),[[0,499],[500,999]]);
  const branchClient=mockClient({cash_movements:[],expenses:[]});
  await fetchFinanceWorkspace({client:branchClient,orgId:"org-a",branchId:"branch-a",startIso:"2026-11-01",endIso:"2026-12-01"});
  assert.ok(branchClient.calls.every(call=>call.filters.some(([key,value])=>key==="branch_id"&&value==="branch-a")));
  await assert.rejects(()=>fetchFinanceWorkspace({client,orgId:"org-a",startIso:"invalid",endIso:"2026-12-01"}),{name:"TypeError"});
  await assert.rejects(()=>fetchFinanceWorkspace({client,orgId:"",startIso:"2026-11-01",endIso:"2026-12-01"}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>fetchFinanceWorkspace({client:failing,orgId:"org-a",startIso:"2026-11-01",endIso:"2026-12-01"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.from=()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>fetchFinanceWorkspace({client:network,orgId:"org-a",startIso:"2026-11-01",endIso:"2026-12-01"}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do serviço financeiro: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
