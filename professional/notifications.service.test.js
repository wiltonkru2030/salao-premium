/** Testa payload individual, validação de contador e estados da central. */
import assert from "node:assert/strict";
import {fetchProfessionalNotifications,markProfessionalNotificationsRead} from "./notifications.service.js";
import {renderNotificationsView} from "./views/notifications.views.js";
import {allowedProfessionalPages} from "./access.rules.js";
let call;
const client={rpc:async(name,args)=>{call={name,args};return {data:name.startsWith("get_")?{items:[],unread_count:3}:1};}};
assert.deepEqual(await fetchProfessionalNotifications({client,organizationId:"org",onlyUnread:true}),{items:[],unreadCount:3});
assert.deepEqual(call.args,{target_org:"org",only_unread:true});
assert.equal(await markProfessionalNotificationsRead({client,organizationId:"org",notificationId:"n"}),1);
assert.deepEqual(call.args,{target_org:"org",target_notification:"n"});
await assert.rejects(()=>fetchProfessionalNotifications({client:{rpc:async()=>({data:{items:[],unread_count:-1}})},organizationId:"org"}),/carregar/);
assert.equal(allowedProfessionalPages({role:"professional",scope:"self",professional:{id:"p"},notificationsEnabled:true}).includes("Notificações"),true);
const html=renderNotificationsView({notificationsStatus:"ready",notificationsUnread:1,notificationsFilter:false,notifications:[{id:"n",title:"<script>",body:"Novo aviso",created_at:"2026-11-27T01:00:00Z"}]});
assert.doesNotMatch(html,/<script>/);assert.match(html,/Marcar como lida/);
console.log("Notificações profissionais: OK");
