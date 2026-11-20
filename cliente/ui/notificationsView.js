/**
 * Central de notificações internas da cliente.
 * Responsabilidade: exibir eventos de agendamento recebidos do backend.
 */
import { escapeClientHtml } from "./view-utils.js";

/** Formata data/hora de criação da notificação para pt-BR. */
function dateLabel(value) {
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(date):"";
}

/** Renderiza notificações próprias sem simular lembretes ou mensagens externas. */
export function renderNotificationsView({items=[],loading=false,error=""}={}) {
  if(loading)return '<section class="page-content"><div class="empty-state"><span class="spinner"></span><p>Carregando notificações…</p></div></section>';
  if(error)return '<section class="page-content"><button class="text-button" data-action="back-profile">‹ Voltar ao perfil</button><div class="empty-state"><h3>Notificações indisponíveis</h3><p>'+escapeClientHtml(error)+'</p></div></section>';
  const unread=items.filter(item=>!item.read_at).length;
  const content=items.length?'<div class="notification-list">'+items.map(item=>
    '<article class="notification-card '+(!item.read_at?'unread':'')+'"><div><strong>'+escapeClientHtml(item.title)+'</strong><p>'+escapeClientHtml(item.body)+'</p><small>'+escapeClientHtml(dateLabel(item.created_at))+'</small></div>'+(!item.read_at?'<button class="text-button" data-action="mark-notification-read" data-notification-id="'+escapeClientHtml(item.id)+'">Marcar como lida</button>':'<span class="notification-read-label">Lida</span>')+'</article>'
  ).join("")+'</div>':'<div class="empty-state"><h3>Nenhuma notificação</h3><p>Quando houver atualizações nos seus agendamentos, elas aparecerão aqui.</p></div>';
  return '<section class="page-content"><button class="text-button" data-action="back-profile">‹ Voltar ao perfil</button><div class="page-heading"><h1>Notificações</h1><p>Atualizações dos seus agendamentos.</p></div>'+(unread?'<button class="text-button" data-action="mark-all-notifications-read">Marcar todas como lidas</button>':'')+content+'</section>';
}
