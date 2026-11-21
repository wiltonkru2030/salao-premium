/**
 * Testes do serviço de dados da equipe.
 * Responsabilidade: validar escopo por organização, filtros de membros e perfis relacionados.
 */
import assert from "node:assert/strict";
import {fetchProfessionalWorkspace,setProfessionalActive,setTeamProfessionalAppAccess,revokeProfessionalAppAccess,createProfessionalWithServices,updateProfessionalProfile} from "./professionals.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:name==="create_professional_with_services"?"professional-new":{enabled:args.p_enabled},error};},from(table) {
    const call={table,filters:[],orders:[],limit:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      update(payload){call.action="update";call.payload=payload;return query;},
      maybeSingle(){return query;},
      eq(key,value){call.filters.push(["eq",key,value]);return query;},
      or(expression){call.or=expression;return query;},
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
  const branchClient=mockClient({
    professionals:[{id:"pro-b",org_id:"org-a",branch_id:"11111111-1111-4111-8111-111111111111"}]
  });
  await fetchProfessionalWorkspace({client:branchClient,orgId:"org-a",currentUserId:"owner-a",branchId:"11111111-1111-4111-8111-111111111111"});
  // Profissionais sem filial permanecem visíveis, sem consultar outra organização.
  assert.equal(branchClient.calls.find(call=>call.table==="professionals").or,"branch_id.eq.11111111-1111-4111-8111-111111111111,branch_id.is.null");
  assert.equal(branchClient.calls.find(call=>call.table==="services").or,"branch_id.eq.11111111-1111-4111-8111-111111111111,branch_id.is.null");

  await assert.rejects(()=>fetchProfessionalWorkspace({client,orgId:"",currentUserId:"owner-a"}),{name:"TypeError"});
  await setProfessionalActive({client,orgId:"org-a",professionalId:"pro-a",active:false});
  const activationCall=client.calls.at(-1);
  assert.deepEqual(activationCall.payload,{active:false});
  assert.deepEqual(activationCall.filters,[["eq","org_id","org-a"],["eq","id","pro-a"]]);
  const scopedProfessional=mockClient({professionals:[{id:"pro-a",org_id:"org-a",branch_id:"11111111-1111-4111-8111-111111111111"}]});
  await setProfessionalActive({client:scopedProfessional,orgId:"org-a",branchId:"11111111-1111-4111-8111-111111111111",professionalId:"pro-a",active:false});
  assert.deepEqual(scopedProfessional.calls[0].filters,[
    ["eq","org_id","org-a"],["eq","id","pro-a"],["eq","branch_id","11111111-1111-4111-8111-111111111111"]
  ]);
  await assert.rejects(()=>setProfessionalActive({client,orgId:"org-a",branchId:"unidade-invalida",professionalId:"pro-a",active:false}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>fetchProfessionalWorkspace({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const access=await setTeamProfessionalAppAccess({client,orgId:"org-a",userId:"reception-a",role:"receptionist",enabled:true});
  assert.equal(access.enabled,true);
  const accessCall=client.calls.find(call=>call.rpc==="set_professional_app_access");
  assert.equal(accessCall.args.p_org_id,"org-a");
  assert.equal(accessCall.args.p_scope,"calendar_all");
  await revokeProfessionalAppAccess({client,orgId:"org-a",professionalId:"pro-a"});
  assert.ok(client.calls.some(call=>call.rpc==="revoke_professional_app_access"&&call.args.p_org_id==="org-a"));
  await assert.rejects(()=>setTeamProfessionalAppAccess({client,orgId:"org-a",userId:"pro-a",role:"professional",enabled:true}),{name:"TypeError"});
  const createdId=await createProfessionalWithServices({
    client,orgId:"org-a",branchId:"11111111-1111-4111-8111-111111111111",name:"Ana",commissionRate:50,taxRegime:"individual",serviceIds:["svc-a"]
  });
  assert.equal(createdId,"professional-new");
  const createCall=client.calls.find(call=>call.rpc==="create_professional_with_services");
  assert.equal(createCall.args.p_org_id,"org-a");
  assert.equal(createCall.args.p_branch_id,"11111111-1111-4111-8111-111111111111");
  assert.deepEqual(createCall.args.p_service_ids,["svc-a"]);
  await assert.rejects(()=>createProfessionalWithServices({
    client,orgId:"org-a",name:"Ana",commissionRate:150,serviceIds:["svc-a"]
  }),{name:"TypeError"});
  // A edição deve preservar vínculos e credenciais e respeitar a filial ativa.
  const editBranch="11111111-1111-4111-8111-111111111111";
  const editable=mockClient({professionals:[{id:"pro-a",org_id:"org-a",branch_id:editBranch}]});
  await updateProfessionalProfile({client:editable,orgId:"org-a",branchId:editBranch,
    professionalId:"pro-a",name:"Ana Maria",phone:"11999999999",email:"ana@example.com",
    specialty:"Cabeleireira",commissionRate:45,taxRegime:"individual"});
  const editCall=editable.calls.find(call=>call.table==="professionals");
  assert.equal(editCall.action,"update");
  assert.equal(editCall.payload.name,"Ana Maria");
  assert.equal(editCall.payload.commission_rate,45);
  assert.equal(editCall.payload.access_enabled,undefined);
  assert.equal(editCall.payload.service_ids,undefined);
  assert.ok(editCall.filters.some(filter=>filter[1]==="branch_id"&&filter[2]===editBranch));
  await assert.rejects(()=>updateProfessionalProfile({client:editable,orgId:"org-a",
    professionalId:"pro-a",name:"Ana",commissionRate:101,taxRegime:"individual"}),{name:"TypeError"});
  await assert.rejects(()=>updateProfessionalProfile({client:editable,orgId:"org-a",
    professionalId:"pro-a",name:"Ana",commissionRate:40,taxRegime:"mei",cnpj:"1",legalName:"Empresa"}),{name:"TypeError"});
  console.log("Testes do serviço de dados dos profissionais: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
