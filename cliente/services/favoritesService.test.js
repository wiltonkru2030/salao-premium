/**
 * Testes do serviço de favoritos da identidade global.
 * Responsabilidade: validar RPC, RLS errors e operações insert/delete.
 */
import assert from "node:assert/strict";
import { listFavorites, addFavorite, removeFavorite } from "./favoritesService.js";
const orgId="11111111-1111-4111-8111-111111111111";
const user={id:"22222222-2222-4222-8222-222222222222"};
function clientMock({rpc={data:[],error:null},insertError=null,deleteData=[{org_id:orgId}],deleteError=null}={}) {
  const calls=[];
  const client={
    auth:{getUser:async()=>({data:{user},error:null})},
    rpc:async(name,args)=>{calls.push({name,args});return rpc;},
    from(table){
      assert.equal(table,"customer_favorites");
      return {
        insert:async row=>{calls.push({insert:row});return {error:insertError};},
        delete(){
          const query={eq(){return query;},select:async()=>({data:deleteData,error:deleteError})};
          return query;
        }
      };
    }
  };
  return {client,calls};
}
async function run(){
  const rows=[{org_id:orgId,slug:"studio",branch_id:"branch"}];
  const list=clientMock({rpc:{data:rows,error:null}});
  assert.deepEqual(await listFavorites({client:list.client}),rows);
  assert.deepEqual(list.calls[0],{name:"list_my_favorite_salons",args:undefined});

  const add=clientMock();
  assert.equal(await addFavorite({client:add.client,orgId}),true);
  assert.deepEqual(add.calls[0],{insert:{auth_user_id:user.id,org_id:orgId}});

  const duplicate=clientMock({insertError:{code:"23505"}});
  assert.equal(await addFavorite({client:duplicate.client,orgId}),true);

  const remove=clientMock();
  assert.equal(await removeFavorite({client:remove.client,orgId}),true);

  await assert.rejects(()=>addFavorite({client:add.client,orgId:"invalid"}),{name:"TypeError"});
  const noAuth={...add.client,auth:{getUser:async()=>({data:{user:null},error:null})}};
  await assert.rejects(()=>listFavorites({client:noAuth}),/Entre na sua conta/);
  const missing=clientMock({rpc:{data:null,error:{code:"PGRST202"}}});
  await assert.rejects(()=>listFavorites({client:missing.client}),error=>error.code==="FAVORITES_NOT_READY");
  console.log("Testes do serviço de favoritos: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
