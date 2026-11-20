/**
 * Testes do serviço de dados da equipe.
 * Responsabilidade: validar escopo por organização, filtros de membros e perfis relacionados.
 */
import assert from "node:assert/strict";
import {fetchProfessionalWorkspace,setProfessionalActive} from "./professionals.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],orders:[],limit:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      update(payload){call.action="update";call.payload=payload;return query;},
      maybeSingle(){return query;},
      eq(key,value){call.filters.push(["eq",key,value]);return query;},
      in(key,values){call.filters.push(["in",key,values]);return query;},
      order(key){call.orders.push(key);return query;},
      limit(value){call.limit=value;return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        const rows=(tables[table]||[]).filter(row=>call.filters.every(([,key,value])=>
          call.filters.find(filter=>filter[1]===key)?.[0]==="in"?value.includes(row[key]):row[key]===value
        ));
        if(call.action==="update")return Promise.resolve({data:rows[0]||null,error:null}).then(resolve,reject);
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
}
async function run() {
  const client=mockClient({
    professionals:[{id:"pro-a",org_id:"org-a",name:"Ana"}],
    services:[{id:"svc-a",org_id:"org-a",name:"Corte",active:true}],
    org_memberships:[
      {user_id:"owner-a",org_id:"org-a",role:"owner",status:"active"},
      {user_id:"reception-a",org_id:"org-a",role:"receptionist",status:"active"},
      {user_id:"pro-b",org_id:"org-a",role:"professional",status:"active"}
    ],
    professional_services:[{professional_id:"pro-a",service_id:"svc-a",org_id:"org-a"}],
    profiles:[{id:"owner-a",full_name:"Proprietário"},{id:"reception-a",full_name:"Recepção"}]
  });
  const result=await fetchProfessionalWorkspace({client,orgId:"org-a",currentUserId:"owner-a"});
  assert.equal(result.professionals.length,1);
  assert.equal(result.services.length,1);
  assert.equal(result.assignments.length,1);
  assert.equal(result.members.length,2);
  assert.equal(result.profiles.length,2);
  assert.ok(client.calls.filter(call=>call.table!=="profiles").every(call=>call.filters.some(filter=>filter[1]==="org_id"&&filter[2]==="org-a")));
  assert.ok(client.calls.find(call=>call.table==="profiles").filters.some(filter=>filter[1]==="id"&&filter[0]==="in"));
  assert.ok(client.calls.find(call=>call.table==="org_memberships").filters.some(filter=>filter[1]==="role"&&filter[0]==="in"));
  await assert.rejects(()=>fetchProfessionalWorkspace({client,orgId:"",currentUserId:"owner-a"}),{name:"TypeError"});
  await setProfessionalActive({client,orgId:"org-a",professionalId:"pro-a",active:false});
  const activationCall=client.calls.at(-1);
  assert.deepEqual(activationCall.payload,{active:false});
  assert.deepEqual(activationCall.filters,[["eq","org_id","org-a"],["eq","id","pro-a"]]);
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>fetchProfessionalWorkspace({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  console.log("Testes do serviço de dados dos profissionais: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
