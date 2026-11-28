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

// A configuração pública fornecida pelo proprietário habilita QA sem segredo no bundle.
const supplied=readPushConfig({VITE_PROFESSIONAL_PUSH:"true"});
assert.equal(supplied.config.projectId,"salao-premium");
assert.equal(supplied.config.messagingSenderId,"357526985236");
assert.match(supplied.vapidKey,/^[A-Za-z0-9_-]{87}$/);
assert.equal(Object.hasOwn(supplied.config,"private_key"),false);
assert.equal(readPushConfig({VITE_PROFESSIONAL_PUSH:"false"}),null);

// Preferência é específica da conta e salão, e o conteúdo de push não carrega dados privados.
const {createPushConsent,foregroundNotice}=await import("./push-consent.js");
const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const consent=createPushConsent(storage);
assert.equal(consent.matches("user","org"),false);
assert.equal(consent.save("user","org"),true);
assert.equal(consent.matches("user","org"),true);
assert.equal(consent.matches("other","org"),false);
assert.equal(consent.matches("user","other"),false);
assert.doesNotMatch([...memory.values()][0],/token|private_key/);
consent.clear();assert.equal(consent.matches("user","org"),false);
const id="550e8400-e29b-41d4-a716-446655440000";
assert.equal(foregroundNotice({data:{notification_id:"bad"}}),null);
assert.equal(foregroundNotice({data:{notification_id:id,title:"Cliente agendou"}}).title,"Cliente agendou");
const safe=foregroundNotice({data:{notification_id:id,title:"Nome privado",body:"Telefone"}});
assert.equal(safe.title,"SALÃO PREMIUM");assert.doesNotMatch(JSON.stringify(safe),/Nome privado|Telefone/);
assert.equal(safe.options.data.notificationId,id);

// Identidade visual deve ser idêntica com o app aberto ou em segundo plano.
assert.equal(safe.options.icon,"/professional/notification-icon.webp");
assert.equal(safe.options.badge,"/professional/notification-badge.png");
const {readFileSync}=await import("node:fs");
const {runInNewContext}=await import("node:vm");
const read=path=>readFileSync(new URL(path,import.meta.url));
assert.deepEqual(read("./notification-icon.webp"),read("../brand/identidade-visual/logo/1_20261111_222414_0000.webp"));
const badge=read("./notification-badge.png");
assert.equal(badge.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
assert.equal(badge.readUInt32BE(16),72);assert.equal(badge.readUInt32BE(20),72);assert.equal(badge[25],6);
let background,shown;
const firebase={initializeApp(){},messaging(){return {onBackgroundMessage(fn){background=fn;}};}};
runInNewContext(read("./sw.js").toString(),{URL,firebase,importScripts(){},self:{location:{href:"https://example.test/professional/sw.js?fcm="+encodeURIComponent(JSON.stringify(config))},addEventListener(){},registration:{showNotification(title,options){shown={title,options};return Promise.resolve();}}}});
assert.equal(typeof background,"function");
await background({data:{notification_id:id,title:"Cliente agendou"}});
assert.equal(shown.options.icon,safe.options.icon);assert.equal(shown.options.badge,safe.options.badge);
assert.equal(shown.options.data.notificationId,id);assert.equal(shown.title,"Cliente agendou");
console.log("Marca oficial e badge Android nos dois modos de push: OK");
