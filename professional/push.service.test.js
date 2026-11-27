/** Teste sem SDK, rede ou credenciais reais. */
import assert from "node:assert/strict";
import {readPushConfig,setPushDevice} from "./push.service.js";
assert.equal(readPushConfig({}),null);
assert.equal(readPushConfig({VITE_PROFESSIONAL_PUSH:"true",VITE_PROFESSIONAL_FIREBASE_CONFIG:"bad"}),null);
const config={apiKey:"public",projectId:"test",messagingSenderId:"123",appId:"app",privateKey:"never"};
const result=readPushConfig({VITE_PROFESSIONAL_PUSH:"true",VITE_PROFESSIONAL_FIREBASE_CONFIG:JSON.stringify(config),VITE_PROFESSIONAL_FIREBASE_VAPID_KEY:"public"});
assert.equal(result.config.privateKey,undefined);
let call;const client={rpc:async(name,args)=>{call={name,args};return {data:args.enabled};}};
assert.equal(await setPushDevice(client,"org","token",true),true);
assert.deepEqual(call,{name:"set_professional_push_device",args:{target_org:"org",device_token:"token",enabled:true}});
assert.equal(await setPushDevice(client,"org","token",false),false);
await assert.rejects(()=>setPushDevice({rpc:async()=>({error:{}})},"org","token",true),/Não foi possível/);
console.log("Notificações FCM: contrato e configuração OK");
