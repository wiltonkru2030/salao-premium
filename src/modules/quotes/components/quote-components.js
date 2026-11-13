/**
 * Componentes de apresentação de Orçamentos.
 * Recebem dados e devolvem marcação; não consultam Supabase nem alteram estado global.
 */
import { esc } from "../../../utils.js";

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusName = value => ({draft:"Rascunho",pending:"Em análise",accepted:"Aceito",rejected:"Recusado",expired:"Expirado",cancelled:"Cancelado"})[value] || "Status não identificado";

export function renderQuoteBuilder({ items, selectedCustomer, services, professionals, discountRules, maxDiscount, allowFixedDiscount, canManageSettings }) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  const sum = { subtotal, discount, total: subtotal - discount };
  return `
    <section class="settings-card quote-builder-card">
      <div class="section-title"><div><h3>Novo orçamento</h3><small class="muted">Monte uma proposta com serviços e responsáveis individuais.</small></div><span class="status">Proposta comercial</span></div>
      <label>Cliente <input id="quote-customer-search" class="field" placeholder="Buscar por nome ou WhatsApp" autocomplete="off" value="${esc(selectedCustomer?.name || "")}"></label>
      <div id="quote-customer-results" class="quote-suggestions"></div>
      <div id="quote-selected-customer">${selectedCustomer ? '<div class="notice">Cliente vinculado: <b>'+esc(selectedCustomer.name)+'</b> · '+esc(selectedCustomer.phone||"WhatsApp não informado")+'</div>' : '<small class="muted">Selecione um cliente para continuar.</small>'}</div>
      <div id="quote-quick-customer" hidden>
        <form id="quote-quick-customer-form" class="form-grid">
          <label>Nome completo<input class="field" name="name" required maxlength="120"></label>
          <label>WhatsApp<input class="field" name="phone" type="tel" required placeholder="(00) 00000-0000"></label>
          <button class="btn primary" type="submit">Cadastrar e vincular</button>
          <button class="btn secondary" type="button" id="quote-quick-cancel">Cancelar</button>
        </form>
      </div>
      <div class="quote-item-entry">
        <label>Serviço<select class="field" id="quote-service"><option value="">Selecione um serviço</option>${services.map(s=>'<option value="'+s.id+'">'+esc(s.name)+' · '+money(s.price)+'</option>').join("")}</select></label>
        <label>Profissional<select class="field" id="quote-professional" disabled><option value="">Selecione um serviço primeiro</option></select></label>
        <label>Quantidade<input class="field" id="quote-quantity" type="number" min="1" step="1" value="1"></label>
        <label>Tipo de desconto<select class="field" id="quote-discount-mode"><option value="percent">Percentual (%)</option><option value="fixed" ${allowFixedDiscount?"":"disabled"}>Valor (R$)</option></select></label>
        <label>Desconto<input class="field" id="quote-discount" type="number" min="0" step="0.01" value="0"></label>
        <button class="btn secondary" type="button" id="quote-add-item">＋ Adicionar serviço</button>
      </div>
      <div class="quote-items-list">${items.length ? items.map((item,index)=>'<div class="setting-row"><span><b>'+esc(item.name)+'</b><small>'+item.quantity+' × '+money(item.price)+' · '+esc(item.professionalName||"Profissional a definir")+(item.discount?' · Desconto '+money(item.discount):' · Sem desconto')+'</small></span><span class="record-trailing"><b>'+money(item.quantity*item.price-item.discount)+'</b><button type="button" class="btn text" data-remove-quote-item="'+index+'">Remover</button></span></div>').join("") : '<div class="empty-state">Adicione os serviços para compor o orçamento.</div>'}</div>
      <div class="quote-totals">
        <div class="setting-row"><span>Subtotal</span><b>${money(sum.subtotal)}</b></div>
        <div class="setting-row"><span>Descontos</span><b>− ${money(sum.discount)}</b></div>
        <div class="setting-row quote-grand-total"><b>Valor final</b><strong>${money(sum.total)}</strong></div>
      </div>
      <label>Validade do orçamento<input class="field" id="quote-valid-until" type="date"></label>
      <label>Observações<textarea class="field" id="quote-notes" rows="2" maxlength="1000" placeholder="Informações adicionais para o cliente"></textarea></label>
      <button class="btn primary" id="quote-save" type="button" ${!selectedCustomer||!items.length?"disabled":""}>Gerar orçamento e deixar em análise</button>
    </section>
    <section class="settings-card" id="quote-discount-settings-card" ${canManageSettings ? "" : "hidden"}><div class="section-title"><div><h3>Regras de desconto</h3><small class="muted">Defina o limite e quais serviços podem receber desconto.</small></div></div>
      <form id="quote-discount-settings" class="form-grid">
        <label>Desconto máximo permitido (%)<input class="field" name="max_discount_percent" type="number" min="0" max="100" step="0.01" value="${maxDiscount}" required></label>
        <label class="setting-row"><span>Permitir desconto em valor fixo</span><input type="checkbox" name="allow_fixed_discount" ${allowFixedDiscount?"checked":""}></label>
        <div class="quote-discount-services">${services.map(s=>'<label class="setting-row"><span>'+esc(s.name)+'</span><input type="checkbox" name="discount_service" value="'+s.id+'" '+(discountRules.has(s.id)?"checked":"")+'> Permitir desconto</label>').join("")}</div>
        <button class="btn secondary" type="submit">Salvar regras de desconto</button>
      </form>
      <small class="muted">Serviços não autorizados não recebem desconto. Limite 0% significa que nenhum desconto pode ser aplicado.</small>
    </section>`;
}


export function renderQuoteList(quotes, customersById) {
  return '<div class="section-title section-title--spaced"><h2>Orçamentos recentes</h2><span class="result-count">'+quotes.length+

' registro(s)</span></div><div class="record-list">'+
(quotes.map(q=>'<article class="record-card"><span class="record-main"><b>Orçamento #'+q.quote_number+

' · '+esc(customersById.get(q.customer_id)||"Cliente")+

'</b><small>'+new Date(q.created_at).toLocaleString("pt-BR")+

' · '+esc(statusName(q.status))+

'</small></span><span class="record-trailing"><b>'+money(q.total)+

'</b><button class="btn secondary" data-open-quote="'+q.id+

'">Abrir</button></span></article>').join("")||'<div class="empty-state">Nenhum orçamento criado.</div>')+

'</div>';
}

