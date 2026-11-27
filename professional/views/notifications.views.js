/** Tela de notificações: apresentação pura, componentes globais e estados acessíveis. */
import {escapeHtml as esc,formatDateTime} from "../utils/formatters.js";
import {salonTimezone} from "../utils/salon-time.js";

/** Exibe somente conteúdo recebido do servidor, com marcação explícita de leitura. */
export function renderNotificationsView(state){
 const heading='<div class="section-title"><h2>Notificações</h2><button type="button" class="btn secondary" data-action="refresh-professional-notifications">Atualizar</button></div>';
 if(state.notificationsStatus==="loading"||state.notificationsStatus==="idle")return heading+'<p role="status">Carregando notificações...</p>';
 if(state.notificationsStatus==="error")return heading+'<p role="alert">Não foi possível consultar suas notificações.</p><button class="btn secondary" data-action="refresh-professional-notifications">Tentar novamente</button>';
 const tz=salonTimezone(state.organization?.timezone);
 const rows=state.notifications.map(item=>'<article class="detail sp-content-surface"><div class="professional-record-heading"><strong>'+esc(item.title)+'</strong><span class="tag">'+(item.read_at?"Lida":"Não lida")+'</span></div><p>'+esc(item.body)+'</p><p class="meta">'+esc(formatDateTime(item.created_at,tz))+'</p>'+
 (!item.read_at?'<button type="button" class="btn secondary" data-notification-read="'+esc(item.id)+'">Marcar como lida</button>':"")+'</article>').join("");
 return heading+'<section class="detail sp-content-surface"><p><strong>'+esc(state.notificationsUnread)+'</strong> não lidas</p><div class="professional-card-actions"><button class="btn '+(!state.notificationsFilter?"primary":"secondary")+'" type="button" data-notification-filter="all" aria-pressed="'+String(!state.notificationsFilter)+'">Todas</button><button class="btn '+(state.notificationsFilter?"primary":"secondary")+'" type="button" data-notification-filter="unread" aria-pressed="'+String(state.notificationsFilter)+'">Não lidas</button></div>'+
 (state.notificationsUnread>0?'<button class="btn secondary" data-action="read-all-professional-notifications" type="button">Marcar todas como lidas</button>':"")+'</section>'+
 (rows||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhuma notificação disponível neste filtro.</p>')+
 '<p class="muted">Exibindo até 100 avisos recentes. Os lembretes são verificados ao atualizar a central. Avisos no celular com o aplicativo fechado ainda não estão disponíveis.</p>';
}
