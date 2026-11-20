/**
 * Testes do serviço de histórico de vendas.
 * Responsabilidade: validar escopo tenant, relações e tratamento seguro de falhas.
 */
import assert from "node:assert/strict";
import {fetchSalesWorkspace} from "./sales.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],limit:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      in(key,values){call.filters.push([key,values]);return query;},
      order(key,options){call.order=[key,options];return query;},
      limit(value){call.limit=value;return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        const rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
}
async function run(){
  const client=mockClient({
    sales:[{id:"sale-a",org_id:"org-a",customer_id:"customer-a",sale_number:1,total:50}],
    customers:[{id:"customer-a",org_id:"org-a",name:"Maria"}],
    sale_items:[{id:"item-a",org_id:"org-a",sale_id:"sale-a",description:"Corte",total:50}]
  });
  const result=await fetchSalesWorkspace({client,orgId:"org-a"});
  assert.equal(result.sales.length,1);
  assert.equal(result.customers.get("customer-a"),"Maria");
  assert.equal(result.itemsBySale.get("sale-a").length,1);
  assert.ok(client.calls.every(call=>call.filters.some(([key,value])=>key==="org_id"&&value==="org-a")));
  assert.equal(client.calls.find(call=>call.table==="sales").limit,200);
  await assert.rejects(()=>fetchSalesWorkspace({client,orgId:"",limit:200}),{name:"TypeError"});
  await assert.rejects(()=>fetchSalesWorkspace({client,orgId:"org-a",limit:0}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>fetchSalesWorkspace({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.from=()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>fetchSalesWorkspace({client:network,orgId:"org-a"}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do serviço de histórico de vendas: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
