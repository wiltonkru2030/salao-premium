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
