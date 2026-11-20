/**
 * Testes de sincronização remota das preferências globais da cliente.
 * Responsabilidade: validar chamadas RPC e mensagens seguras.
 */
import assert from "node:assert/strict";
import { getRemoteSettings, saveRemoteSettings, setSettingsAccount, getLocalSettings, saveLocalSettings, sanitizeSettings } from "./settingsService.js";
function mockClient(response){const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push({name,args});return response;}}};}
async function run(){
  assert.deepEqual(sanitizeSettings({theme:"invalid",reminders:"true",promotions:false,defaultCity:"  São Paulo  ",auth_user_id:"other"}),{promotions:false,defaultCity:"São Paulo"});
  assert.deepEqual(sanitizeSettings(null),{});
  const prefs={theme:"dark",defaultCity:"Três Lagoas",reminders:true};
  const get=mockClient({data:prefs,error:null});
  assert.deepEqual(await getRemoteSettings({client:get.client}),prefs);
  const save=mockClient({data:{...prefs,promotions:false},error:null});
  assert.equal((await saveRemoteSettings({client:save.client,patch:{promotions:false,auth_user_id:"other",theme:"invalid"}})).promotions,false);
  assert.deepEqual(save.calls[0],{name:"update_my_customer_preferences",args:{p_preferences:{promotions:false}}});
  const missing=mockClient({data:null,error:{code:"PGRST202"}});
  await assert.rejects(()=>getRemoteSettings({client:missing.client}),/ainda está sendo ativada/);
  await assert.rejects(()=>saveRemoteSettings({client:{}}),{name:"TypeError"});
  // Simula armazenamento comum em aparelho compartilhado, sem persistir dados reais.
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const storage=new Map();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
  try{
    setSettingsAccount("conta-a");saveLocalSettings({defaultCity:"Cidade A",theme:"dark"});
    setSettingsAccount("conta-b");assert.equal(getLocalSettings().defaultCity,null);
    saveLocalSettings({defaultCity:"Cidade B"});
    setSettingsAccount("conta-a");assert.equal(getLocalSettings().defaultCity,"Cidade A");
    assert.equal(getLocalSettings().theme,"dark");
    setSettingsAccount(null);assert.equal(getLocalSettings().defaultCity,null);
  }finally{
    setSettingsAccount(null);
    if(previous)Object.defineProperty(globalThis,"localStorage",previous);
    else delete globalThis.localStorage;
  }
  console.log("Testes das preferências remotas: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
