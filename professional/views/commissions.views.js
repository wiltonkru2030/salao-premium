/** Apresenta extrato, filtros e registro de repasse com componentes globais. */
import {escapeHtml as esc,formatMoney as money,formatDateTime as dateTime} from "../utils/formatters.js";
import {salonTimezone} from "../utils/salon-time.js";
import {filterCommissionStatement,commissionStatusLabel,commissionTypeLabel,paymentMethodLabel} from "../commissions.rules.js";

/** Linha financeira consistente, sem tabelas e sem recalcular o valor persistido. */
function detail(label,value){return '<div class="detail-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';}
function commissionCard(c,tz){
 const name=c.service_order_items?.description||commissionTypeLabel(c.item_type);
 return '<article class="commission sp-content-surface"><div class="professional-record-heading"><div class="record-main"><strong>'+esc(name)+'</strong><p class="meta">'+esc(commissionTypeLabel(c.item_type))+(Number(c.amount)<0?' · Débito por estorno':'')+'</p></div><b>'+money(c.amount)+'</b></div>'+
 detail("Base registrada",money(c.base_amount))+detail("Percentual",Number(c.rate).toLocaleString("pt-BR")+"%")+detail("Registro",dateTime(c.created_at,tz))+
 (c.paid_at?detail("Repasse",dateTime(c.paid_at,tz)):"")+'<span class="tag">'+esc(commissionStatusLabel(c.status))+'</span></article>';
}
/** Registro interno do pagamento: não é comprovante bancário e não altera o Caixa. */
function payoutDetail(state,tz){
 const payout=state.selectedPayout;
 const rows=state.commissions.filter(row=>row.payout_id===payout.id);
 return '<button type="button" class="btn secondary" data-action="back-professional-payout">← Voltar ao extrato</button>'+
 '<section class="detail sp-content-surface"><h2>Registro de pagamento de comissão</h2><p class="muted">Registro interno do salão, não substitui comprovante bancário.</p>'+
 detail("Salão",state.organization?.name||"Salão")+detail("Profissional",state.professional?.name||"Profissional")+detail("Valor recebido",money(payout.amount))+detail("Forma de pagamento",paymentMethodLabel(payout.payment_method))+detail("Data",dateTime(payout.paid_at,tz))+detail("Identificador do repasse",payout.id)+(payout.cash_movement_id?detail("Referência do Caixa",payout.cash_movement_id):"")+(payout.notes?detail("Observações",payout.notes):"")+'</section>'+
 '<div class="section-title"><h2>Comissões vinculadas</h2></div>'+(rows.map(row=>commissionCard(row,tz)).join("")||'<p class="muted">Nenhum lançamento vinculado disponível.</p>');
}
function options(values,current){return values.map(([value,label])=>'<option value="'+esc(value)+'"'+(current===value?' selected':'')+'>'+esc(label)+'</option>').join("");}
/** Saldo integral e recorte de histórico separados para evitar leitura financeira ambígua. */
export function commissionsView(state){
 const title='<div class="section-title"><h2>Comissões</h2><button class="btn secondary" type="button" data-action="refresh-professional-commissions">Atualizar</button></div>';
 if(state.commissionStatus==="loading"||state.commissionStatus==="idle")return title+'<p role="status">Carregando extrato...</p>';
 if(state.commissionStatus==="error")return title+'<p role="alert">Não foi possível carregar o extrato completo.</p><button type="button" class="btn secondary" data-action="refresh-professional-commissions">Tentar novamente</button>';
 const tz=salonTimezone(state.organization?.timezone);
 if(state.selectedPayout)return payoutDetail(state,tz);
 const f=state.commissionFilters||{};
 let statement;
 try{statement=filterCommissionStatement(state.commissions,state.commissionPayouts,f,tz);}
 catch{return title+'<p role="alert">Não foi possível validar os valores do extrato. Atualize ou consulte o salão.</p>';}
 const {global,period,commissions,payouts}=statement;
 return title+'<section class="detail sp-content-surface professional-commission-summary"><div class="professional-balance"><span>Saldo líquido em aberto · geral</span><strong>'+money(global.open)+'</strong></div>'+
 detail("Créditos em aberto",money(global.credit))+detail("Débitos por estorno",money(global.debit))+detail("Repasses recebidos · geral",money(global.received))+
 '<p class="muted">O saldo considera todo o histórico; o pagamento depende do Caixa.</p></section>'+
 '<section class="detail sp-content-surface"><h3>Filtrar histórico</h3><form id="professional-commission-filter"><label class="sp-labeled-field">De<input name="from" type="date" value="'+esc(f.from||"")+'"></label><label class="sp-labeled-field">Até<input name="to" type="date" value="'+esc(f.to||"")+'"></label>'+
 '<label class="sp-labeled-field">Situação<select name="status">'+options([["all","Todas"],["pending","Pendentes"],["approved","Aprovadas"],["paid","Pagas"],["reversal","Estornos"],["cancelled","Canceladas"]],f.status||"all")+'</select></label>'+
 '<label class="sp-labeled-field">Tipo<select name="type">'+options([["all","Todos"],["service","Serviços"],["product","Produtos"]],f.type||"all")+'</select></label><p role="alert" data-commission-filter-error hidden></p><div class="professional-card-actions"><button class="btn secondary" type="button" data-action="reset-professional-commission-filters">Limpar</button><button class="btn primary" type="submit">Filtrar</button></div></form></section>'+
 '<section class="detail sp-content-surface"><h3>Resumo da seleção</h3>'+detail("Saldo em aberto dos lançamentos filtrados",money(period.open))+detail("Repasses no período (todos os tipos)",money(period.received))+'</section>'+
 '<div class="section-title"><h2>Lançamentos de comissão</h2><span class="muted">'+commissions.length+' registros</span></div>'+
 (commissions.map(row=>commissionCard(row,tz)).join("")||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhuma comissão neste filtro.</p>')+
 '<div class="section-title"><h2>Pagamentos recebidos</h2></div><p class="muted">Filtrados pela data do repasse, independentemente da situação ou tipo de comissão.</p>'+
 (payouts.map(row=>'<article class="commission sp-content-surface"><strong>'+money(row.amount)+'</strong><p class="meta">'+esc(paymentMethodLabel(row.payment_method))+' · '+esc(dateTime(row.paid_at,tz))+'</p><button type="button" class="btn secondary" data-professional-payout="'+esc(row.id)+'">Ver registro</button></article>').join("")||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhum pagamento no período.</p>');
}
