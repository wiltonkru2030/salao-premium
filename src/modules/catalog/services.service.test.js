/**
 * Testes do serviço de catálogo de serviços.
 * Responsabilidade: validar paginação, payloads, escopo por organização e inativação.
 */
import assert from "node:assert/strict";
import {listServices,saveService,setServiceActive} from "./services.service.js";

function mockClient(tables={},error=null){
  const calls=[];
  const client={calls,from(table){
    const call={table,filters:[],action:null,payload:null,range:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      insert(payload){call.action="insert";call.payload=payload;return query;},
      update(payload){call.action="update";call.payload=payload;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      or(expression){call.or=expression;return query;},
      order(key){call.order=key;return query;},
      range(start,end){call.range=[start,end];return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        let rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        const [start,end]=call.range||[0,249];
        return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
  return client;
}
async function run(){
  const rows=Array.from({length:251},(_,i)=>({id:"s"+i,org_id:"org-a",name:"Serviço "+i}));
  const client=mockClient({services:rows});
  assert.equal((await listServices({client,orgId:"org-a"})).length,251);
  const branchClient=mockClient({services:[]});
  await listServices({client:branchClient,orgId:"org-a",branchId:"11111111-1111-4111-8111-111111111111"});
  assert.equal(branchClient.calls[0].or,"branch_id.eq.11111111-1111-4111-8111-111111111111,branch_id.is.null");
  assert.deepEqual(client.calls.filter(c=>c.table==="services").map(c=>c.range),[[0,249],[250,499]]);
  await saveService({client,orgId:"org-a",name:"Corte",category:"Cabelo",durationMinutes:30,price:80});
  assert.equal(client.calls[2].payload.org_id,"org-a");
  assert.equal(client.calls[2].payload.duration_minutes,30);
  await saveService({client,orgId:"org-a",serviceId:"s1",name:"Corte atualizado",durationMinutes:45,price:90});
  assert.deepEqual(client.calls[3].filters,[["org_id","org-a"],["id","s1"]]);
  await setServiceActive({client,orgId:"org-a",serviceId:"s1",active:false});
  assert.deepEqual(client.calls[4].payload,{active:false});
  // Regressão: a filial ativa deve limitar edição e inativação.
  const branchId="11111111-1111-4111-8111-111111111111";
  const scoped=mockClient({services:[]});
  await saveService({client:scoped,orgId:"org-a",branchId,name:"Corte",durationMinutes:30,price:80});
  assert.equal(scoped.calls[0].payload.branch_id,branchId);
  await saveService({client:scoped,orgId:"org-a",branchId,serviceId:"s1",name:"Corte",durationMinutes:30,price:80});
  assert.equal(scoped.calls[1].or,"branch_id.eq."+branchId+",branch_id.is.null");
  await setServiceActive({client:scoped,orgId:"org-a",branchId,serviceId:"s1",active:false});
  assert.equal(scoped.calls[2].or,"branch_id.eq."+branchId+",branch_id.is.null");
  await assert.rejects(()=>saveService({client,orgId:"org-a",name:"Corte",durationMinutes:33,price:20}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>listServices({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.from=()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>saveService({client:network,orgId:"org-a",name:"Corte",durationMinutes:30,price:50}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do catálogo de serviços: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
