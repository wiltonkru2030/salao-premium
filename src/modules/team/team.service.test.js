/**
 * Testes do serviço de equipe e permissões.
 * Responsabilidade: validar escopo do tenant, perfis e RPC de acesso explícito.
 */
import assert from "node:assert/strict";
import {fetchTeamWorkspace,fetchTeamBranches,setTeamBranchAssignment,setReceptionAppAccess} from "./team.service.js";

function mockClient(tables={},rpcResult={data:{enabled:true},error:null},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[]};calls.push(call);
    const query={
      upsert(payload,options){call.payload=payload;call.options=options;return query;},
      delete(){call.deleted=true;return query;},
      select(columns){call.columns=columns;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      in(key,values){call.filters.push([key,values]);return query;},
      order(key){call.order=key;return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        const rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      }
    };
    return query;
  },rpc:async(name,args)=>{calls.push({rpc:name,args});return rpcResult;}};
}
async function run(){
  const client=mockClient({
    org_memberships:[
      {org_id:"org-a",user_id:"owner-a",role:"owner",status:"active"},
      {org_id:"org-a",user_id:"reception-a",role:"receptionist",status:"active"}
    ],
    profiles:[{id:"owner-a",full_name:"Proprietário"},{id:"reception-a",full_name:"Recepção"}]
  });
  const result=await fetchTeamWorkspace({client,orgId:"org-a"});
  assert.equal(result.members.length,2);
  assert.equal(result.profiles.length,2);
  assert.ok(client.calls.every(call=>call.table!=="org_memberships"||call.filters.some(([key,value])=>key==="org_id"&&value==="org-a")));
  const changed=await setReceptionAppAccess({client,orgId:"org-a",userId:"reception-a",enabled:true});
  assert.equal(changed.enabled,true);
  const rpc=client.calls.find(call=>call.rpc);
  assert.equal(rpc.rpc,"set_professional_app_access");
  assert.equal(rpc.args.p_org_id,"org-a");
  assert.equal(rpc.args.p_scope,"calendar_all");
  await assert.rejects(()=>fetchTeamWorkspace({client,orgId:""}),{name:"TypeError"});
  await assert.rejects(()=>setReceptionAppAccess({client,orgId:"org-a",userId:"x",enabled:"yes"}),{name:"TypeError"});
  const failing=mockClient({},null,{code:"42501",message:"SQL privado"});
  await assert.rejects(()=>fetchTeamWorkspace({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.rpc=async()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>setReceptionAppAccess({client:network,orgId:"org-a",userId:"x",enabled:false}),e=>!e.message.includes("network SQL secret"));
  const units = mockClient({
    branches: [
      {id:"matrix",org_id:"org-a",active:true},
      {id:"inactive",org_id:"org-a",active:false},
      {id:"other",org_id:"org-b",active:true}
    ],
    branch_memberships: [{org_id:"org-a",branch_id:"matrix",user_id:"manager"}]
  });
  const workspace = await fetchTeamBranches({client:units,orgId:"org-a"});
  assert.deepEqual(workspace.branches.map(branch=>branch.id),["matrix"]);
  assert.equal(workspace.assignments.length,1);
  const assignment = {client:units,orgId:"org-a",branchId:"matrix",userId:"manager"};
  await setTeamBranchAssignment({...assignment,assigned:true});
  assert.deepEqual(units.calls.at(-1).payload,{org_id:"org-a",branch_id:"matrix",user_id:"manager"});
  assert.equal(units.calls.at(-1).options.ignoreDuplicates,true);
  await setTeamBranchAssignment({...assignment,assigned:false});
  assert.deepEqual(units.calls.at(-1).filters,[["org_id","org-a"],["branch_id","matrix"],["user_id","manager"]]);
  await assert.rejects(()=>setTeamBranchAssignment({...assignment,userId:"other",assigned:false}),/permissão/);
  console.log("Testes do serviço de equipe: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
