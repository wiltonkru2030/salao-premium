/**
 * Testes do serviço de notificações internas da cliente.
 * Responsabilidade: validar leitura e atualização restrita à conta autenticada.
 */
import assert from "node:assert/strict";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "./notificationService.js";
const user={id:"22222222-2222-4222-8222-222222222222"};
const notificationId="33333333-3333-4333-8333-333333333333";
function clientMock(){
  const calls=[];
  const client={
    auth:{getUser:async()=>({data:{user},error:null})},
    from(table){
      assert.equal(table,"customer_notifications");
      let action="select",payload=null,filters=[];
      const query={
        select(fields){calls.push({select:fields});return query;},
        order(...args){calls.push({order:args});return query;},
        limit(value){calls.push({limit:value});return Promise.resolve({data:[{id:notificationId,title:"Agendamento confirmado"}],error:null});},
        update(value){action="update";payload=value;return query;},
        eq(key,value){filters.push([key,value]);return query;},
        is(key,value){filters.push([key,value]);return query;},
        maybeSingle(){return Promise.resolve({data:{id:notificationId},error:null});},
        then(resolve,reject){return Promise.resolve({data:[{id:notificationId},{id:"44444444-4444-4444-8444-444444444444"}],error:null}).then(resolve,reject);}
      };
      return query;
    }
  };
  return {client,calls};
}
async function run(){
  const mock=clientMock();
  const rows=await listNotifications({client:mock.client,limit:20});
  assert.equal(rows.length,1);
  assert.ok(mock.calls.some(c=>c.limit===20));
  assert.equal(await markNotificationRead({client:mock.client,notificationId}),true);
  assert.equal(await markAllNotificationsRead({client:mock.client}),2);
  await assert.rejects(()=>listNotifications({client:mock.client,limit:500}),{name:"TypeError"});
  await assert.rejects(()=>markNotificationRead({client:mock.client,notificationId:"bad"}),{name:"TypeError"});
  console.log("Testes do serviço de notificações: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
