/** Worker do App Profissional: migração segura para assets versionados pelo Vite.
 * Não intercepta rede ou cacheia dados privados. Acesso offline não é oferecido.
 */
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
 // Remove exclusivamente caches legados deste aplicativo, nunca os do painel ou cliente.
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith("salao-profissional-shell-")).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));

/** Avisos genéricos, sem dados de cliente ou valores financeiros. */
self.addEventListener("notificationclick",event=>{
 if(event.notification.tag!=="sp-professional-alert")return;
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL("./",self.registration.scope).href;
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const existing=windows.find(client=>client.url.startsWith(url));
  if(existing){await existing.focus();return;}
  await self.clients.openWindow(url);
 })());
});
try{
 const config=JSON.parse(new URL(self.location.href).searchParams.get("fcm")||"null");
 if(config&&config.apiKey&&config.projectId&&config.messagingSenderId&&config.appId){
  importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js","https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
  firebase.initializeApp(config);
  firebase.messaging().onBackgroundMessage(()=>self.registration.showNotification("SALÃO PREMIUM",{
   body:"Você tem uma atualização. Abra o aplicativo para conferir.",tag:"sp-professional-alert"
  }));
 }
}catch{/* central interna continua independente de FCM */}
