/**
 * Testes do serviço de clientes.
 * Responsabilidade: validar paginação, tenant, normalização e tratamento de erros.
 */
import assert from "node:assert/strict";
import {listCustomers,saveCustomer,setCustomerActive} from "./customers.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],range:null,payload:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      maybeSingle(){return query;},
      single(){return query;},
      insert(payload){call.action="insert";call.payload=payload;return query;},
      update(payload){call.action="update";call.payload=payload;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      order(key){call.order=key;return query;},
      range(start,end){call.range=[start,end];return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        const rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        if(call.action==="insert")return Promise.resolve({data:{id:"created-customer"},error:null}).then(resolve,reject);
        if(call.action==="update"&&!call.range)return Promise.resolve({data:rows[0]||null,error:null}).then(resolve,reject);
        const [start,end]=call.range||[0,249];
        return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
}
async function run(){
  const rows=Array.from({length:501},(_,i)=>({id:"c"+i,org_id:"org-a",name:"Cliente "+i}));
  const client=mockClient({customers:rows});
  assert.equal((await listCustomers({client,orgId:"org-a"})).length,501);
  assert.deepEqual(client.calls.filter(call=>call.table==="customers").map(call=>call.range),[[0,249],[250,499],[500,749]]);
  await saveCustomer({client,orgId:"org-a",name:" Maria ",phone:"(11) 99999-0000",email:"MARIA@EMAIL.COM",birthDate:"1990-01-02"});
  assert.equal(client.calls[3].payload.org_id,"org-a");
  assert.equal(client.calls[3].payload.email,"maria@email.com");
  assert.equal(client.calls[3].payload.name,"Maria");
  await saveCustomer({client,orgId:"org-a",customerId:"c1",name:"Maria Atualizada",birthDate:""});
  assert.deepEqual(client.calls[4].filters,[["org_id","org-a"],["id","c1"]]);
  assert.equal(client.calls[4].payload.birth_date,null);
  await setCustomerActive({client,orgId:"org-a",customerId:"c1",active:false});
  assert.deepEqual(client.calls[5].payload,{active:false});
  await assert.rejects(()=>saveCustomer({client,orgId:"org-a",name:"M",email:"email-invalido"}),{name:"TypeError"});
  await assert.rejects(()=>saveCustomer({client,orgId:"org-a",name:"Maria",birthDate:"2026-13-99"}),{name:"TypeError"});
  await assert.rejects(()=>saveCustomer({client,orgId:"org-a",name:"Maria",birthDate:"2999-12-31"}),{name:"TypeError"});
  const missing=mockClient({customers:[]});
  await assert.rejects(()=>saveCustomer({client:missing,orgId:"org-a",customerId:"missing",name:"Maria"}),e=>e.message.includes("não foi encontrado"));
  await assert.rejects(()=>setCustomerActive({client:missing,orgId:"org-a",customerId:"missing",active:false}),e=>e.message.includes("não foi encontrado"));
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>listCustomers({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.from=()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>saveCustomer({client:network,orgId:"org-a",name:"Maria"}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do serviço de clientes: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
