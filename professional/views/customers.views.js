/** Carteira e ficha do cliente: somente apresentação, usando os componentes globais. */
import {formatSavedPhone} from "../../src/utils/input-masks.js";
import {escapeHtml as esc,formatDateTime,formatMoney,formatStatus} from "../utils/formatters.js";
import {salonTimezone} from "../utils/salon-time.js";

/** Renderiza contato seguro para discagem, sem colocar dados brutos no HTML. */
function contact(customer){
 const phone=String(customer.phone||""),digits=phone.replace(/\D/g,"");
 return '<p class="meta">'+esc(formatSavedPhone(phone)||"Telefone não informado")+'</p>'+
 (digits.length>=10&&digits.length<=15?'<a class="btn secondary" href="tel:'+(phone.trim().startsWith("+")?"+":"")+digits+'">Ligar</a>':"");
}
/** Mostra o histórico próprio com estados de carregamento, erro e ausência de registros. */
function history(state){
 if(state.customerHistoryStatus==="loading")return '<p class="muted" role="status">Carregando histórico...</p>';
 if(state.customerHistoryStatus==="error")return '<p role="alert">Não foi possível carregar o histórico.</p><button class="btn secondary" data-action="retry-professional-customer-history">Tentar novamente</button>';
 return state.customerHistory.map(row=>'<article class="detail sp-content-surface"><strong>'+esc(row.service_name||"Serviço")+'</strong><p class="meta">'+esc(formatDateTime(row.starts_at,salonTimezone(state.organization?.timezone)))+'</p><div class="detail-row"><span>'+esc(formatStatus(row.status))+'</span><b>'+esc(formatMoney(row.price))+'</b></div></article>').join("")||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhum atendimento próprio encontrado nesta unidade.</p>';
}
/** Apresenta a lista pesquisável ou a ficha selecionada; não depende do mês da Agenda. */
export function renderProfessionalCustomers(state){
 if(state.customerEditor&&state.canManageCustomers){
  const editor=state.customerEditor;
  return '<section class="detail sp-content-surface"><div class="section-title"><h2>'+(editor.id?"Editar cliente":"Nova cliente")+'</h2></div>'+
  '<form id="professional-customer-form"><label class="sp-labeled-field">Nome<input name="name" required minlength="2" maxlength="120" autocomplete="name" value="'+esc(editor.name||"")+'"></label>'+
  '<label class="sp-labeled-field">WhatsApp ou telefone<input name="phone" data-mask="phone" inputmode="tel" autocomplete="tel" required value="'+esc(formatSavedPhone(editor.phone||"")||"")+'"></label>'+
  '<p role="alert" data-customer-save-error hidden></p><div class="professional-card-actions"><button type="button" class="btn secondary" data-action="cancel-professional-customer">Cancelar</button><button type="submit" class="btn primary">Salvar cliente</button></div></form></section>';
 }
 if(state.selectedCustomer){
  const customer=state.selectedCustomer;
  return '<button type="button" class="btn secondary" data-action="back-professional-customers">← Voltar aos clientes</button><section class="detail sp-content-surface"><h2>'+esc(customer.name)+'</h2>'+contact(customer)+(state.canManageCustomers&&customer.branch_id===state.professional?.branch_id?'<button class="btn secondary" type="button" data-action="edit-professional-customer">Editar cadastro</button>':"")+'</section><div class="section-title"><h2>Histórico de atendimentos</h2></div><p class="muted">Até 50 atendimentos próprios, nas unidades autorizadas.</p>'+history(state);
 }
 const title='<div class="section-title"><h2 id="professional-customers-heading">Clientes</h2></div>';
 if(state.customersStatus==="loading"||state.customersStatus==="idle")return title+'<p role="status" class="muted">Carregando clientes...</p>';
 if(state.customersStatus==="error")return title+'<p role="alert">Não foi possível carregar os clientes.</p><button class="btn secondary" data-action="refresh-professional-customers">Tentar novamente</button>';
 const rows=state.customers.map(customer=>{
  const name=customer.name||"Cliente",digits=String(customer.phone||"").replace(/\D/g,"");
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toLocaleUpperCase("pt-BR");
  return '<article class="detail sp-content-surface professional-customer-record" data-professional-search-text="'+esc(name)+'" data-professional-phone="'+digits+'"><div class="professional-record-heading"><span class="professional-initials" aria-hidden="true">'+esc(initials)+'</span><div class="record-main"><strong>'+esc(name)+'</strong><p class="meta">'+esc(formatSavedPhone(customer.phone||"")||"Telefone não informado")+'</p></div></div><button class="btn secondary" type="button" data-professional-customer="'+esc(customer.id)+'">Ver ficha</button></article>';
 }).join("");
 return '<section data-professional-list aria-labelledby="professional-customers-heading">'+title+(state.canManageCustomers?'<button type="button" class="btn primary" data-action="new-professional-customer">+ Nova cliente</button>':"")+
 '<div class="professional-list-tools"><label class="sp-labeled-field">Buscar cliente<input type="search" data-professional-list-search placeholder="Nome ou telefone"></label><button class="btn secondary" data-action="refresh-professional-customers">Atualizar</button></div>'+
 '<p class="empty sp-content-surface sp-content-surface--empty" data-professional-search-empty hidden>Nenhum cliente encontrado.</p>'+
 (rows||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhum cliente autorizado encontrado.</p>')+'</section>';
}
