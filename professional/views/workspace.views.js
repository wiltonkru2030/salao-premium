/** Views do aplicativo profissional: comandas, comissões e configurações. Recebem estado e retornam HTML sem efeitos colaterais. */
import { renderPlatformAppearance } from "../../src/components/platform-appearance.js";
import {escapeHtml as esc,formatMoney as money,formatStatus as statusLabel,formatDateTime as dateTimeLabel} from "../utils/formatters.js";
import {canRegisterProfessionalService} from "../access.rules.js";
export {commissionsView} from "./commissions.views.js";
import {renderManagedOrder} from "./order-management.views.js";
/** Apresenta comandas autorizadas e seus detalhes a partir do estado, sem acessar rede. */
export function ordersView(state,{managementEnabled=false}={}){
 if(!state.selectedOrder&&["loading","idle"].includes(state.ordersStatus))return '<div class="section-title"><h2>Comandas</h2></div><p role="status">Carregando comandas...</p>';
 if(!state.selectedOrder&&state.ordersStatus==="error")return '<div class="section-title"><h2>Comandas</h2></div><p role="alert">Não foi possível carregar as comandas.</p><button class="btn secondary" data-action="refresh-professional-orders">Tentar novamente</button>';
 if(state.selectedOrder&&managementEnabled&&state.role==="professional")return renderManagedOrder(state);
 if(state.selectedOrder){
  const order=state.selectedOrder,canRegister=canRegisterProfessionalService(state,order);
  const rows=state.orderItems.length?state.orderItems.map(i=>'<article class="service sp-content-surface"><strong>'+esc(i.description)+'</strong><div class="meta">'+Number(i.quantity)+' × '+money(i.unit_price)+' · '+money(i.total)+'</div><span class="tag">'+(i.item_type==="service"?"Serviço":"Produto")+'</span></article>').join(""):'<div class="empty sp-content-surface sp-content-surface--empty">Nenhum item visível nesta comanda.</div>';
  return '<button class="secondary" data-action="back-orders">← Voltar às comandas</button>'+
   '<div class="detail sp-content-surface"><strong>Comanda #'+esc(order.order_number)+'</strong><div class="detail-row"><span>Status</span><b>'+esc(statusLabel(order.status))+'</b></div><div class="detail-row"><span>Total</span><b>'+money(order.total)+'</b></div></div>'+
   '<div class="section-title"><h2>Atendimentos e itens</h2></div>'+rows+
   (canRegister?'<section class="detail sp-content-surface"><strong>Registrar serviço realizado</strong><label class="sp-labeled-field service-search">Buscar serviço<input id="service-search" placeholder="Digite o nome do serviço" autocomplete="off"></label><button class="primary" id="add-service" disabled>Registrar serviço</button><p class="muted">O valor é confirmado pelo catálogo do salão. Produtos e pagamentos são geridos pela equipe autorizada.</p></section>':"");
 }
 return '<section data-professional-list aria-labelledby="professional-orders-title">'+
 '<div class="section-title"><h2 id="professional-orders-title">Comandas</h2></div>'+
 '<div class="professional-list-tools"><label class="sp-labeled-field">Buscar comanda<input type="search" data-professional-list-search placeholder="Número ou status"></label>'+
 '<button type="button" class="btn secondary" data-action="refresh-professional-orders">Atualizar</button></div>'+
 '<p class="empty sp-content-surface sp-content-surface--empty" data-professional-search-empty hidden>Nenhuma comanda encontrada.</p>'+
 (state.orders.length?state.orders.map(o=>'<button type="button" class="order sp-content-surface" data-professional-search-text="'+
 esc(o.order_number+" "+statusLabel(o.status))+'" data-order="'+esc(o.id)+'"><span class="professional-order-heading"><strong>Comanda #'+esc(o.order_number)+
 '</strong><span class="tag">'+esc(statusLabel(o.status))+'</span></span><span class="detail-row"><span>Total</span><b>'+money(o.total)+'</b></span></button>').join(""):
 '<div class="empty sp-content-surface sp-content-surface--empty">Nenhuma comanda disponível.</div>')+'</section>';

}
export {profileView,settingsView} from "./profile.views.js";
