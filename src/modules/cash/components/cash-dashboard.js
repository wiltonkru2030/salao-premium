/**
 * Componente visual do Caixa.
 * Recebe valores já calculados e histórico já consultado; não acessa banco nem estado global.
 */
import { esc } from "../../../utils.js";

const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=value=>value?new Date(value).toLocaleString("pt-BR"):"—";

/**
 * @param {object} data Resumo do caixa, histórico e movimentos do tenant ativo.
 * @returns {string} HTML da visão operacional do Caixa.
 */
export function renderCashDashboard({active,activeNet,income,expense,net,movements,history,registers,canOperate}){
return (
   '<section class="settings-card"><div class="section-title"><div><h3>Caixa atual</h3><small class="muted">'+
(active?"Aberto desde "+dateTime(active.opened_at):"Nenhum caixa aberto")+

'</small></div><b class="status">'+
(active?"Aberto":"Fechado")+

'</b></div>'+

   (active?'<div class="setting-row"><span>Valor de abertura</span><b>'+money(active.opening_amount)+

'</b></div><div class="setting-row"><span>Movimentação líquida do caixa</span><b>'+money(activeNet)+

'</b></div><div class="setting-row"><span>Saldo esperado</span><b>'+money(Number(active.opening_amount||0)+activeNet)+

'</b></div>'+

    (canOperate?'<form id="cash-close-form" class="form-grid"><label>Valor contado no fechamento (R$)<input class="field" name="closing_amount" type="number" min="0" step="0.01" required></label><button class="btn primary" type="submit">Conferir e fechar caixa</button></form>':"") :
    (canOperate?'<form id="cash-open-form" class="form-grid"><label>Valor inicial (R$)<input class="field" name="opening_amount" type="number" min="0" step="0.01" value="0" required></label><button class="btn primary" type="submit">Abrir caixa</button></form>':'<p class="demo-note">Seu perfil não pode abrir ou fechar o caixa.</p>'))+


   '</section>'+


   '<section class="settings-card"><h3>Resumo de hoje</h3><div class="commission-summary"><div><small class="eyebrow">ENTRADAS</small><h2>'+money(income)+

'</h2></div><div><small class="eyebrow">SAÍDAS</small><h2>'+money(expense)+

'</h2></div><div><small class="eyebrow">SALDO DO DIA</small><h2>'+money(net)+

'</h2></div></div></section>'+


   '<div class="section-title section-title--spaced"><h2>Movimentações</h2><span class="result-count">Últimos '+movements.length+

' lançamento(s)</span></div>'+


   '<section class="settings-card cash-filters"><div class="form-grid"><label>Buscar cliente ou comanda<input class="field" id="cash-filter-search" placeholder="Nome ou número"></label><label>De<input class="field" id="cash-filter-from" type="date"></label><label>Até<input class="field" id="cash-filter-to" type="date"></label><label>Forma de pagamento<select class="field" id="cash-filter-method"><option value="">Todas</option><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="credit_card">Crédito</option><option value="debit_card">Débito</option><option value="transfer">Transferência</option><option value="voucher">Voucher</option><option value="other">Outro</option></select></label></div></section>'+


   '<div class="record-list" id="cash-movement-list">'+
(history||'<div class="empty-state">Nenhuma movimentação registrada. Os pagamentos da Comanda aparecerão aqui, inclusive os parciais.</div>')+

'</div>'+


   '<div class="section-title section-title--spaced"><h2>Histórico de caixas</h2></div>'+


   '<div class="record-list">'+
(registers.map(r=>'<article class="record-card"><span class="record-main"><b>'+esc(r.status==="open"?"Caixa aberto":"Caixa fechado")+

'</b><small>Abertura '+dateTime(r.opened_at)+
(r.closed_at?' · Fechamento '+dateTime(r.closed_at):"")+

'</small></span><span class="record-trailing"><b>'+money(r.status==="open"?r.opening_amount:r.closing_amount)+

'</b><small>'+
(r.status==="open"?"Em andamento":"Diferença: "+money(Number(r.closing_amount||0)-Number(r.expected_amount||0)))+

'</small></span></article>').join("")||'<div class="empty-state">Nenhuma abertura de caixa registrada.</div>')+

'</div>'
  );
}
