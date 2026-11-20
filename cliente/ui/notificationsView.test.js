/**
 * Testes da central de notificações da cliente.
 */
import assert from "node:assert/strict";
import { renderNotificationsView } from "./notificationsView.js";
assert.ok(renderNotificationsView({loading:true}).includes("Carregando notificações"));
assert.ok(renderNotificationsView({error:"Falha <script>"}).includes("Falha &lt;script&gt;"));
assert.ok(renderNotificationsView({items:[]}).includes("Nenhuma notificação"));
const html=renderNotificationsView({items:[{id:"n1",title:"Agendamento confirmado",body:"Seu horário está confirmado",created_at:"2026-11-20T10:00:00Z",read_at:null}]});
assert.ok(html.includes('data-action="mark-notification-read"'));
assert.ok(html.includes('data-action="mark-all-notifications-read"'));
console.log("Testes da tela de notificações: OK");
