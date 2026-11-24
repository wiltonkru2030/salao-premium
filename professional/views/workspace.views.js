/** Views do aplicativo profissional: comandas, comissões e configurações. Recebem estado e retornam HTML sem efeitos colaterais. */
import { renderPlatformAppearance } from "../../src/components/platform-appearance.js";
import {escapeHtml as esc,formatMoney as money,formatStatus as statusLabel,formatDateTime as dateTimeLabel} from "../utils/formatters.js";
import {canRegisterProfessionalService,summarizeProfessionalCommissions} from "../access.rules.js";
// Apresenta comandas autorizadas e seus detalhes.
export function ordersView(state){
 if(state.selectedOrder){
  const order=state.selectedOrder,canRegister=canRegisterProfessionalService(state,order);
  const rows=state.orderItems.length?state.orderItems.map(i=>'<article class="service"><strong>'+esc(i.description)+'</strong><div class="meta">'+Number(i.quantity)+' × '+money(i.unit_price)+' · '+money(i.total)+'</div><span class="tag">'+(i.item_type==="service"?"Serviço":"Produto")+'</span></article>').join(""):'<div class="empty">Nenhum item visível nesta comanda.</div>';
  return '<button class="secondary" data-action="back-orders">← Voltar às comandas</button>'+
   '<div class="detail"><strong>Comanda #'+esc(order.order_number)+'</strong><div class="detail-row"><span>Status</span><b>'+esc(statusLabel(order.status))+'</b></div><div class="detail-row"><span>Total</span><b>'+money(order.total)+'</b></div></div>'+
   '<div class="section-title"><h2>Atendimentos e itens</h2></div>'+rows+
   (canRegister?'<section class="detail"><strong>Registrar serviço realizado</strong><label class="field service-search">Buscar serviço<input id="service-search" placeholder="Digite o nome do serviço" autocomplete="off"></label><button class="primary" id="add-service" disabled>Registrar serviço</button><p class="muted">O valor é confirmado pelo catálogo do salão. Produtos e pagamentos são geridos pela equipe autorizada.</p></section>':"");
 }
 return '<div class="section-title"><h2>Comandas</h2><span class="muted">Atendimentos vinculados ao seu acesso</span></div>'+
 (state.orders.length?state.orders.map(o=>'<button class="order" data-order="'+esc(o.id)+'"><strong>Comanda #'+esc(o.order_number)+'</strong><div class="meta">Status: '+esc(statusLabel(o.status))+' · '+money(o.total)+'</div></button>').join(""):'<div class="empty">Nenhuma comanda disponível.</div>');
}
// Apresenta valores e histórico de comissões do profissional.
export function commissionsView(state){
 const summary=summarizeProfessionalCommissions(state.commissions,state.commissionPayouts);
 const payoutTotal=summary.received;
 return '<div class="section-title"><h2>Comissões</h2><span class="muted">Valores, histórico e pagamentos</span></div>'+
 '<section class="detail"><div class="detail-row"><span>Créditos em aberto</span><b>'+money(summary.credit)+'</b></div><div class="detail-row"><span>Débitos por estorno</span><b>'+money(summary.debit)+'</b></div><div class="detail-row"><span>Saldo líquido</span><b>'+money(summary.open)+'</b></div></section>'+
 '<div class="section-title"><h2>Histórico de comissões</h2></div>'+
 (state.commissions.length?state.commissions.map(c=>'<article class="commission"><strong>'+money(c.amount)+'</strong><div class="meta">'+(Number(c.amount)<0?"Débito por estorno · ":"")+'Base: '+money(c.base_amount)+' · Taxa: '+Number(c.rate)+'%<br>Registro: '+dateTimeLabel(c.created_at)+(c.paid_at?' · Pagamento: '+dateTimeLabel(c.paid_at):'')+'</div><span class="tag">'+esc(statusLabel(c.status))+'</span></article>').join(""):'<div class="empty">Nenhuma comissão registrada.</div>')+
 '<div class="section-title"><h2>Pagamentos recebidos</h2><span class="muted">'+money(payoutTotal)+' em pagamentos</span></div>'+
 (state.commissionPayouts.length?state.commissionPayouts.map(p=>'<article class="commission"><strong>'+money(p.amount)+'</strong><div class="meta">'+esc(p.payment_method)+' · '+dateTimeLabel(p.paid_at)+(p.notes?' · '+esc(p.notes):'')+'</div><span class="tag success">Pago</span></article>').join(""):'<div class="empty">Nenhum pagamento de comissão registrado.</div>');
}
// Apresenta dados de perfil e segurança da conta.
export function settingsView(state, appearance){
 const name=state.profile?.full_name||state.professional?.name||"";
 return '<div class="section-title"><h2>Configurações</h2><span class="muted">Perfil, senha e preferências</span></div>'+
 '<section class="detail"><div class="detail-row"><span>Salão</span><b>'+esc(state.organization?.name||"Conta vinculada")+'</b></div><div class="detail-row"><span>Permissão</span><b>'+esc(state.scope==="all"?"Acesso completo":state.scope==="calendar_all"?"Agenda completa":"Somente seus dados")+'</b></div>'+
 '<label class="field">Nome<input id="profile-name" value="'+esc(name)+'" maxlength="120"></label><label class="field">Telefone<input id="profile-phone" data-mask="phone" value="'+esc(state.profile?.phone||"")+'" inputmode="tel"></label><button class="primary" data-action="save-profile">Salvar perfil</button></section>'+
 '<section class="detail"><h3>Senha</h3><label class="field">Nova senha<input id="settings-password" type="password" minlength="10" autocomplete="new-password" placeholder="Mínimo de 10 caracteres"></label><button class="secondary" data-action="change-password">Atualizar senha</button><p class="muted">A redefinição de senha também pode ser feita pelo administrador.</p></section>'+
 '<section class="detail">' + renderPlatformAppearance(appearance) + '</section>' +
 '<button class="secondary" data-action="logout">Sair da conta</button>';
}
