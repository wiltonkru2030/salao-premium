/** FCM opt-in: configuração pública e inscrição explícita; sem credenciais de servidor. */
const SDK="https://www.gstatic.com/firebasejs/11.10.0/";
/** Lê apenas campos públicos de configuração. */
export function readPushConfig(env=import.meta.env||{}){
 if(env.VITE_PROFESSIONAL_PUSH!=="true")return null;
 try{
  const config=JSON.parse(env.VITE_PROFESSIONAL_FIREBASE_CONFIG||"{}"),vapidKey=env.VITE_PROFESSIONAL_FIREBASE_VAPID_KEY;
  const keys=["apiKey","projectId","messagingSenderId","appId"];
  if(!keys.every(key=>typeof config[key]==="string"&&config[key])||typeof vapidKey!=="string"||!vapidKey)return null;
  return {config:Object.fromEntries(keys.map(key=>[key,config[key]])),vapidKey};
 }catch{return null;}
}
/** Mantém um único worker do aplicativo, configurado apenas quando habilitado. */
export async function registerProfessionalWorker(config=readPushConfig()){
 if(!globalThis.navigator?.serviceWorker)return null;
 const url=new URL("./sw.js",globalThis.location.href);
 if(config)url.searchParams.set("fcm",JSON.stringify(config.config));
 return navigator.serviceWorker.register(url,{updateViaCache:"none"});
}
/** Envia token somente à RPC autorizada; não usa armazenamento próprio de credenciais. */
export async function setPushDevice(client,organizationId,token,enabled){
 const {data,error}=await client.rpc("set_professional_push_device",{target_org:organizationId,device_token:token,enabled});
 if(error||data!==enabled)throw new Error("Não foi possível atualizar as notificações deste dispositivo.");
 return data;
}
/** Carrega SDK somente sob demanda e protege a troca de contexto. */
export function createProfessionalPush({client,config=readPushConfig(),onMessage=()=>{}}){
 let instance=null,unsubscribe=null,active=null,pending=false,generation=0;
 async function getMessaging(){
  if(!config||!globalThis.Notification||!navigator.serviceWorker)throw new Error("Notificações no dispositivo indisponíveis.");
  if(!instance){
   const [firebase,messaging]=await Promise.all([import(/* @vite-ignore */SDK+"firebase-app.js"),import(/* @vite-ignore */SDK+"firebase-messaging.js")]);
   if(!await messaging.isSupported())throw new Error("Este navegador não suporta notificações no dispositivo.");
   const name="salao-profissional-push";
   const app=firebase.getApps().find(a=>a.name===name)||firebase.initializeApp(config.config,name);
   instance={sdk:messaging,messaging:messaging.getMessaging(app)};
  }
  return instance;
 }
 /** Solicita permissão somente após ação explícita. */
 async function enable(organizationId,isCurrent=()=>true){
  if(pending)throw new Error("Aguarde a operação anterior.");
  pending=true;const epoch=++generation,current=()=>epoch===generation&&isCurrent();
  try{
   if(!config||!globalThis.Notification)throw new Error("Serviço de notificações não configurado.");
   if(await Notification.requestPermission()!=="granted")throw new Error("Permissão de notificações não concedida.");
   if(!current())throw new Error("A sessão foi alterada.");
   const registration=await registerProfessionalWorker(config);
   if(!registration)throw new Error("Instalação de notificações indisponível.");
   const {sdk,messaging}=await getMessaging();
   const token=await sdk.getToken(messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
   if(!token||!current())throw new Error("Não foi possível concluir a inscrição.");
   await setPushDevice(client,organizationId,token,true);
   if(!current()){await setPushDevice(client,organizationId,token,false).catch(()=>{});throw new Error("A sessão foi alterada.");}
   active={organizationId,token};
   unsubscribe?.();unsubscribe=sdk.onMessage(messaging,()=>{if(current())onMessage();});
   return true;
  }finally{pending=false;}
 }
 /** Cancela inscrição no servidor e no navegador; nunca cria inscrição para desativá-la. */
 async function disable(organizationId){
  generation++;unsubscribe?.();unsubscribe=null;
  const previous=active;active=null;
  let failed=false;
  if(previous){try{await setPushDevice(client,previous.organizationId,previous.token,false);}catch{failed=true;}}
  try{
   if(config&&globalThis.navigator?.serviceWorker){
    const registration=await navigator.serviceWorker.getRegistration(new URL("./",location.href));
    const subscription=await registration?.pushManager.getSubscription();
    if(subscription){
     const {sdk,messaging}=await getMessaging();
     await sdk.deleteToken(messaging);
     await subscription.unsubscribe().catch(()=>{});
    }
   }
  }catch{failed=true;}
  if(failed)throw new Error("Não foi possível confirmar a remoção. Revogue a permissão de notificações nas configurações do navegador.");
  return false;
 }
 return {configured:!!config,enable,disable};
}
