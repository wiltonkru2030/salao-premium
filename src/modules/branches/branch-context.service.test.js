/**
 * Testes do resolvedor de contexto de filial.
 * Responsabilidade: validar matriz padrão, persistência de seleção e vínculo profissional.
 */
import assert from "node:assert/strict";
import {resolveBranchContext} from "./branch-context.service.js";

function mockClient(tables={}) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],range:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      order(key,options){call.orders??=[];call.orders.push([key,options]);return query;},
      range(start,end){call.range=[start,end];return query;},
      maybeSingle(){const row=(tables[table]||[]).find(item=>call.filters.every(([key,value])=>item[key]===value));return Promise.resolve({data:row||null,error:null});},
      then(resolve,reject){const rows=(tables[table]||[]).filter(item=>call.filters.every(([key,value])=>item[key]===value));const [start,end]=call.range||[0,199];return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);}
    };
    return query;
  }};
}
async function run(){
  const branches=[
    {id:"main",org_id:"org-a",name:"Matriz",is_main:true,active:true},
    {id:"branch-a",org_id:"org-a",name:"Centro",is_main:false,active:true},
    {id:"inactive",org_id:"org-a",name:"Fechada",is_main:false,active:false}
  ];
  const client=mockClient({branches,professionals:[{org_id:"org-a",profile_id:"user-pro",branch_id:"branch-a"}]});
  const owner=await resolveBranchContext({client,orgId:"org-a",role:"owner"});
  assert.equal(owner.branches.length,2);
  assert.equal(owner.branch.id,"main");
  const receptionist=await resolveBranchContext({client,orgId:"org-a",role:"receptionist",previousBranchId:"branch-a"});
  assert.equal(receptionist.branch.id,"branch-a");
  const allUnits=await resolveBranchContext({client,orgId:"org-a",role:"owner",previousBranchId:"__all__"});
  assert.equal(allUnits.branch.isAll,true);
  assert.equal(allUnits.branch.id,null);
  const professional=await resolveBranchContext({client,orgId:"org-a",role:"professional",userId:"user-pro"});
  assert.equal(professional.branch.id,"branch-a");
  // Regressão: nunca executar busca profissional sem usuário autenticado.
  const before=client.calls.length;
  await assert.rejects(
    ()=>resolveBranchContext({client,orgId:"org-a",role:"professional"}),
    {name:"TypeError"}
  );
  assert.equal(client.calls.length,before,"sem usuário, nenhuma consulta deve ser executada");
  const empty=await resolveBranchContext({
    client:mockClient({branches:[]}),orgId:"org-a",role:"owner",previousBranchId:"__all__"
  });
  assert.equal(empty.branch,null,"sem filiais ativas não deve existir seleção global artificial");
  await assert.rejects(()=>resolveBranchContext({client,orgId:""}),{name:"TypeError"});
  console.log("Testes do contexto de filial: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
