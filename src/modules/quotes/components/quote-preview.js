/** Apresentação da proposta comercial, sem persistência ou eventos. */
import {esc} from "../../../utils.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const statusName=value=>({draft:"Rascunho",pending:"Em análise",accepted:"Aceito",rejected:"Recusado",expired:"Expirado",cancelled:"Cancelado"})[value]||value;
/** Renderiza o orçamento consultado, incluindo os profissionais de cada item. */
export function renderQuotePreview(activeQuote){
 const id=esc(activeQuote.id);
  return '<section class="settings-card quote-preview"><div class="section-title"><div><small class="eyebrow">SALÃO PREMIUM · PROPOSTA COMERCIAL</small><h2>Orçamento #'+esc(activeQuote.quote_number)+
'</h2><small class="muted">'+esc(statusName(activeQuote.status))+
' · '+new Date(activeQuote.created_at).toLocaleDateString("pt-BR")+
'</small></div><span class="status">'+esc(statusName(activeQuote.status))+
'</span></div><h3>Cliente: '+esc(activeQuote.customer?.name||"Cliente")+
'</h3><div class="record-list">'+activeQuote.items.map(i=>'<div class="setting-row"><span><b>'+esc(i.description)+
'</b><small>'+Number(i.quantity)+
' × '+money(i.unit_price)+
' · '+Number(i.duration_minutes)+
' min · '+esc(i.professionalName)+
'</small></span><span class="record-trailing"><b>'+money(i.total)+
'</b>'+(i.discount_amount?'<small>Desconto '+money(i.discount_amount)+
'</small>':'')+
'</span></div>').join("")+
'</div><div class="quote-totals"><div class="setting-row"><span>Subtotal</span><b>'+money(activeQuote.subtotal)+
'</b></div><div class="setting-row"><span>Desconto</span><b>− '+money(activeQuote.discount_total)+
'</b></div><div class="setting-row quote-grand-total"><b>Valor final</b><strong>'+money(activeQuote.total)+
'</strong></div></div><p class="muted">'+esc(activeQuote.notes||"")+
'</p><div class="quote-actions"><button class="btn secondary" id="quote-back">Voltar</button><button class="btn secondary" id="quote-print">Gerar PDF / Imprimir</button><button class="btn secondary" id="quote-whatsapp">Abrir WhatsApp (anexar PDF)</button>'+(activeQuote.status==="pending"?'<button class="btn primary" data-quote-status="accepted" data-quote-id="'+id+
'">Marcar como aceito</button><button class="btn secondary" data-quote-status="rejected" data-quote-id="'+id+
'">Marcar como recusado</button>':"")+(activeQuote.status==="accepted"?'<button class="btn primary" id="quote-schedule" data-quote-id="'+id+
'">Agendar horários</button><button class="btn secondary" data-quote-status="cancelled" data-quote-id="'+id+
'">Cancelar orçamento</button>':"")+
'</div></section>';
}
