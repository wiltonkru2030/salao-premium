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
 if(!String(event.notification.tag||"").startsWith("sp-professional-alert"))return;
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL("./",self.registration.scope);
  const id=event.notification.data?.notificationId;
  if(typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))target.searchParams.set("notification",id);
  const url=target.href;
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const existing=windows.find(client=>client.url.startsWith(self.registration.scope));
  if(existing){try{const updated=await existing.navigate(url);if(updated){await updated.focus();return;}}catch{/* abre a rota em nova janela se necessário */}}
  await self.clients.openWindow(url);
 })());
});
try{
 const config=JSON.parse(new URL(self.location.href).searchParams.get("fcm")||"null");
 if(config&&config.apiKey&&config.projectId&&config.messagingSenderId&&config.appId){
  importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js","https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
  firebase.initializeApp(config);
  firebase.messaging().onBackgroundMessage(payload=>{
   const raw=payload.data?.notification_id;
   const id=typeof raw==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)?raw:null;
   const title=["Cliente agendou","Cliente cancelou","Cliente confirmou","Cliente reagendou","Salão agendou","Salão cancelou","Salão confirmou","Salão reagendou","Profissional agendou","Profissional cancelou","Profissional confirmou","Profissional reagendou","Novo agendamento","Agendamento cancelado","Agendamento confirmado","Agendamento alterado","Agendamento transferido","Novo atendimento atribuído","Atendimento próximo","Pagamento de comissão registrado"].includes(payload.data?.title)?payload.data.title:"SALÃO PREMIUM";
   return self.registration.showNotification(title,{
    body:"SALÃO PREMIUM · Abra o aplicativo para conferir os detalhes.",
    // Marca original colorida e silhueta monocromática para o Android.
    icon:"/professional/notification-icon.webp",badge:"/professional/notification-badge.png",tag:id?"sp-professional-alert-"+id:"sp-professional-alert",data:{notificationId:id}
   });
  });
 }
}catch{/* central interna continua independente de FCM */}
