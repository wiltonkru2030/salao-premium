/**
 * Testes de sincronização remota das preferências globais da cliente.
 * Responsabilidade: validar chamadas RPC e mensagens seguras.
 */
import assert from "node:assert/strict";
import { getRemoteSettings, saveRemoteSettings } from "./settingsService.js";
function mockClient(response){const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push({name,args});return response;}}};}
async function run(){
  const prefs={theme:"dark",defaultCity:"Três Lagoas",reminders:true};
  const get=mockClient({data:prefs,error:null});
  assert.deepEqual(await getRemoteSettings({client:get.client}),prefs);
  const save=mockClient({data:{...prefs,promotions:false},error:null});
  assert.equal((await saveRemoteSettings({client:save.client,patch:{promotions:false}})).promotions,false);
  assert.deepEqual(save.calls[0],{name:"update_my_customer_preferences",args:{p_preferences:{promotions:false}}});
  const missing=mockClient({data:null,error:{code:"PGRST202"}});
  await assert.rejects(()=>getRemoteSettings({client:missing.client}),/ainda está sendo ativada/);
  await assert.rejects(()=>saveRemoteSettings({client:{}}),{name:"TypeError"});
  console.log("Testes das preferências remotas: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
