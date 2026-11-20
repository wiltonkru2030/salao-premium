/**
 * Testes do serviço de unidades/filiais.
 * Responsabilidade: validar tenant, paginação, matriz protegida e falhas seguras.
 */
import assert from "node:assert/strict";
import {listBranches,saveBranch,setBranchActive} from "./branches.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],range:null,payload:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      insert(payload){call.action="insert";call.payload=payload;return query;},
      update(payload){call.action="update";call.payload=payload;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      order(key,options){call.orders??=[];call.orders.push([key,options]);return query;},
      range(start,end){call.range=[start,end];return query;},
      maybeSingle(){const row=(tables[table]||[]).find(item=>call.filters.every(([key,value])=>item[key]===value));return Promise.resolve({data:row||null,error});},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        const rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        const [start,end]=call.range||[0,199];
        return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
}
async function run(){
  const rows=Array.from({length:201},(_,i)=>({id:"b"+i,org_id:"org-a",name:"Unidade "+i,is_main:i===0,active:true}));
  const client=mockClient({branches:rows});
  assert.equal((await listBranches({client,orgId:"org-a"})).length,201);
  assert.deepEqual(client.calls.filter(call=>call.range).map(call=>call.range),[[0,199],[200,399]]);
  await saveBranch({client,orgId:"org-a",name:"Unidade Nova",email:" UNIDADE@EMAIL.COM "});
  assert.equal(client.calls[2].payload.org_id,"org-a");
  assert.equal(client.calls[2].payload.email,"unidade@email.com");
  assert.equal(client.calls[2].payload.is_main,false);
  await saveBranch({client,orgId:"org-a",branchId:"b1",name:"Unidade Atualizada"});
  assert.deepEqual(client.calls[4].filters,[["org_id","org-a"],["id","b1"]]);
  await assert.rejects(()=>saveBranch({client,orgId:"org-a",branchId:"b0",name:"Matriz"}),{name:"TypeError"});
  await setBranchActive({client,orgId:"org-a",branchId:"b1",active:false});
  assert.deepEqual(client.calls[7].payload.active,false);
  await assert.rejects(()=>saveBranch({client,orgId:"org-a",name:"X"}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>listBranches({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.from=()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>listBranches({client:network,orgId:"org-a"}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do serviço de filiais: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
