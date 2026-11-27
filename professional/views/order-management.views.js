/** Apresentação da comanda com controles globais, sem chamadas de rede. */
import {escapeHtml as esc,formatMoney as money,formatStatus as status} from "../utils/formatters.js";
import {canManageOrder} from "../order-management.service.js";

/** Preserva o serviço original e restringe controles aos itens próprios. */
function itemView(item,state,manage){
 const own=manage&&item.professional_id===state.professional.id;
 return '<article class="detail sp-content-surface professional-control-stack"><div class="professional-service-record"><div class="record-main"><strong>'+esc(item.description)+'</strong><p class="meta">'+esc(item.item_type==="product"?"Produto":"Serviço")+' · '+esc(item.quantity)+' × '+money(item.unit_price)+'</p></div><b>'+money(item.total)+'</b></div>'+
 (Number(item.discount)>0?'<p class="meta">Desconto: '+money(item.discount)+'</p>':"")+
 (own?'<details><summary>Editar item</summary><form data-managed-item-form="'+esc(item.id)+'"><label class="sp-labeled-field">Quantidade<input name="quantity" type="number" min="1" max="999" step="1" required '+(item.source_appointment_id?'readonly ':"")+'value="'+esc(item.quantity)+'"></label><label class="sp-labeled-field">Desconto<input name="discount" inputmode="decimal" data-mask="currency" required value="'+esc(money(item.discount||0))+'"></label><button class="btn primary" type="submit">Salvar item</button></form></details>'+
 (!item.source_appointment_id?'<button class="btn secondary" type="button" data-managed-remove="'+esc(item.id)+'">Remover item</button>':'<p class="muted">Serviço original do atendimento.</p>'):"")+'</article>';
}
/** Mostra controles após carregar itens; estado financeiro permanece no servidor. */
export function renderManagedOrder(state){
 const order=state.selectedOrder,manage=canManageOrder(state,order)&&state.orderItemsStatus==="ready";
 const rows=state.orderItems.map(item=>itemView(item,state,manage)).join("");
 return '<section data-managed-order><button class="btn secondary" type="button" data-action="back-orders">← Voltar às comandas</button>'+
 '<article class="detail sp-content-surface"><h2>Comanda #'+esc(order.order_number)+'</h2><div class="detail-row"><span>Status</span><b>'+esc(status(order.status))+'</b></div><div class="detail-row"><span>Total</span><b>'+money(order.total)+'</b></div></article>'+
 '<p role="alert" data-managed-order-error hidden></p><div class="section-title"><h2>Itens da comanda</h2></div>'+
 (state.orderItemsStatus==="loading"?'<p role="status">Carregando itens...</p>':state.orderItemsStatus==="error"?'<p role="alert">Não foi possível carregar os itens.</p><button class="btn secondary" data-action="retry-professional-order-items">Tentar novamente</button>':rows||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhum item registrado.</p>')+
 (manage?'<section class="detail sp-content-surface professional-control-stack"><h3>Adicionar item</h3><label class="sp-labeled-field">Serviço<div><input type="search" data-managed-service placeholder="Buscar serviço" autocomplete="off"></div></label><button class="btn primary" type="button" data-managed-add="service" disabled>Adicionar serviço</button><label class="sp-labeled-field">Produto<div><input type="search" data-managed-product placeholder="Buscar produto" autocomplete="off"></div></label><button class="btn primary" type="button" data-managed-add="product" disabled>Adicionar produto</button></section><button class="btn secondary" type="button" data-managed-cancel>Cancelar comanda</button>':'<p class="muted">Alterações dependem da autorização do salão e da situação financeira da comanda.</p>')+
 '<p class="muted">Recebimentos e estornos são realizados no Caixa.</p></section>';
}
