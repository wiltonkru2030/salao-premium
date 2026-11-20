/** Módulo Comissões. Responsabilidade: consultar comissões, registrar pagamentos autorizados e exibir histórico. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { mountAutocomplete } from "../components/autocomplete.js";
import { reportError } from "../utils/errors.js";
import { fetchCommissionPageData, fetchCommissionReferences } from "../modules/commissions/commissions.service.js";
import {bindCommissionEvents} from "../modules/commissions/commissions.controller.js";

let cleanupSearch=null;
let lastContext=null,version=0;
let selectedProfessionalFilter=null;
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=value=>value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
const statusLabel=value=>({pending:"Pendente",approved:"Aprovada",paid:"Paga",cancelled:"Cancelada"})[value]||"Status não identificado";
const paymentMethodLabel=value=>({pix:"PIX",cash:"Dinheiro",credit_card:"Cartão de crédito",debit_card:"Cartão de débito",transfer:"Transferência",voucher:"Voucher",other:"Outro"})[value]||"Outro";
const canPay=()=>["owner","admin","manager","finance"].includes(state.membership?.role);
const canManageCommissionSettings=()=>["owner","admin"].includes(state.membership?.role);

/** Renderiza a página de Comissões e o estado inicial de carregamento. */
export function commissionsPage(){
 selectedProfessionalFilter=null;
 return head("Comissões","Valores gerados pelos atendimentos, histórico e pagamentos aos profissionais.")+


  '<div id="commissions-manager"><div class="empty-state">Carregando comissões do banco…</div></div>';
}

/** Carrega regras, lançamentos, pagamentos e referências de Comanda/recebimento da organização ativa; conecta somente ações autorizadas. */
export async function loadCommissionsPage(){
 const host=document.querySelector("#commissions-manager");
 if(!host||!state.organization?.id)return;
 cleanupSearch?.();cleanupSearch=null;
 const context=JSON.stringify([state.organization?.id,state.user?.id,state.membership?.role]);
 const request=++version;
 const current=()=>host.isConnected&&request===version&&context===JSON.stringify([state.organization?.id,state.user?.id,state.membership?.role]);
 if(lastContext!==context){selectedProfessionalFilter=null;lastContext=context;}
 host._commissionConfig=null;
 host.textContent="Carregando comissões…";
 try{
  const orgId=state.organization.id;
  const isProfessional=state.membership?.role==="professional";
  const pageData=await fetchCommissionPageData({
   client:supabase,organizationId:orgId,isProfessional
  });
  const {commissions,professionals,payouts,productSetting,services,serviceRules}=pageData;
  const serviceMap=new Map(services.map(item=>[item.id,item]));
  const references=await fetchCommissionReferences({
   client:supabase,organizationId:orgId,commissions,isProfessional
  });
  if(!current())return;
  const {commissionItems,commissionPayments,commissionOrders}=references;
  const commissionItemMap=new Map(commissionItems.map(item=>[item.id,item]));
  const commissionPaymentMap=new Map(commissionPayments.map(payment=>[payment.id,payment]));
  const commissionOrderMap=new Map(commissionOrders.map(order=>[order.id,order]));
  const productCommissionEnabled=productSetting?.setting_value?.enabled===true;
  const productCommissionRate=Number(productSetting?.setting_value?.default_rate||0);
  const professionalMap=new Map(professionals.map(p=>[p.id,p]));
  const visible=selectedProfessionalFilter?commissions.filter(c=>c.professional_id===selectedProfessionalFilter):commissions;
  // Os handlers são registrados uma vez; mantenha os dados atuais da renderização no host.
  host._commissionConfig={context,orgId,productSetting,serviceRules,professionalMap,visible};
  const totals=visible.reduce((acc,c)=>{acc[c.status]=(acc[c.status]||0)+Number(c.amount||0);return acc;},{});
  const pending=Number(totals.pending||0)+Number(totals.approved||0),paid=Number(totals.paid||0);
  const groups=new Map();
  for(const commission of visible){
   const current=groups.get(commission.professional_id)||[];
   current.push(commission);groups.set(commission.professional_id,current);
  }
  const sections=[...groups.entries()].map(([professionalId,rows])=>{
   const professional=professionalMap.get(professionalId),eligible=rows.filter(c=>["pending","approved"].includes(c.status)&&!c.payout_id&&Number(c.amount)>0);
   return '<section class="settings-card commission-group"><div class="section-title"><div><h3>'+esc(professional?.name||"Profissional")+

'</h3><small class="muted">'+rows.length+

' lançamento(s) · '+money(rows.reduce((sum,c)=>sum+Number(c.amount||0),0))+

'</small></div></div>'+
    rows.map(c=>'<div class="setting-row commission-row"><label class="commission-select">'+
(canPay()&&eligible.some(x=>x.id===c.id)?'<input type="checkbox" data-commission-select="'+c.id+

'" data-professional-id="'+professionalId+

'">':'<span class="commission-select-spacer"></span>')+


     '<span><b>'+money(c.amount)+

'</b><small>'+
(Number(c.amount)<0?"Débito por estorno":c.item_type==="product"?"Produto":"Serviço")+

' · Base '+money(c.base_amount)+

' · '+Number(c.rate)+

'%'+
(commissionOrderMap.get(commissionItemMap.get(c.service_order_item_id)?.order_id||commissionPaymentMap.get(c.service_order_payment_id)?.order_id)?.order_number?' · Comanda #'+commissionOrderMap.get(commissionItemMap.get(c.service_order_item_id)?.order_id||commissionPaymentMap.get(c.service_order_payment_id)?.order_id).order_number:'')+
(commissionPaymentMap.get(c.service_order_payment_id)?' · Parcela '+money(commissionPaymentMap.get(c.service_order_payment_id).amount):'')+

' · '+dateTime(c.created_at)+

'</small></span></label><span class="record-trailing"><b>'+esc(statusLabel(c.status))+

'</b><small>'+
(c.paid_at?'Pago em '+dateTime(c.paid_at):'')+

'</small></span></div>').join("")+

    (canPay()&&eligible.length?'<div class="commission-payout-controls"><select class="field" data-payment-method="'+professionalId+

'"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="other">Outro</option></select><button class="btn primary" type="button" data-pay-commissions="'+professionalId+

'">Pagar selecionadas</button></div>':'')+


    '</section>';
  }).join("");
  const payoutHistory=payouts.map(p=>{
   const professional=professionalMap.get(p.professional_id);
   return '<article class="record-card"><span class="record-main"><b>'+esc(professional?.name||"Profissional")+

' · '+money(p.amount)+

'</b><small>'+dateTime(p.paid_at)+

' · '+esc(paymentMethodLabel(p.payment_method))+

'</small><small>'+esc(p.notes||"Pagamento de comissões")+

'</small></span><span class="record-trailing"><small>Pago</small><small>Caixa vinculado</small></span></article>';
  }).join("");
  // Cada regra liga um profissional a um serviço e define o percentual específico.
  const serviceRulesCard=canManageCommissionSettings()?`<section class="settings-card commission-rules-card"><div class="section-title"><div><h3>Comissão por profissional e serviço</h3><small class="muted">A regra específica prevalece sobre a comissão padrão do profissional.</small></div></div><form id="service-commission-rule-form" class="commission-rule-form"><label>Profissional<select class="field" name="professional_id" required><option value="">Selecione o profissional</option>${professionals.filter(p=>p.active).map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')}</select></label><label>Serviço<select class="field" name="service_id" required><option value="">Selecione o serviço</option>${services.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('')}</select></label><label>Comissão (%)<input class="field" name="rate" type="number" min="0" max="100" step="0.01" placeholder="Ex.: 50" required></label><button class="btn primary" type="submit">Adicionar regra</button></form><div class="commission-rule-list">${serviceRules.map(rule=>{
    const pro=professionalMap.get(rule.professional_id),service=serviceMap.get(rule.service_id);
    return '<form class="commission-rule-row" data-update-commission-rule="'+rule.id+'"><label>Profissional<select class="field" name="professional_id" required>'+professionals.filter(p=>p.active).map(p=>'<option value="'+p.id+'" '+(p.id===rule.professional_id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label>Serviço<select class="field" name="service_id" required>'+services.map(s=>'<option value="'+s.id+'" '+(s.id===rule.service_id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label><label>Comissão (%)<input class="field" name="rate" type="number" min="0" max="100" step="0.01" value="'+Number(rule.rate).toFixed(2)+'" required></label><button class="btn secondary" type="submit">Salvar</button><button class="btn secondary" type="button" data-delete-commission-rule="'+rule.id+'">Excluir</button></form>';
   }).join('')||'<p class="empty-state">Nenhuma regra específica cadastrada. O sistema usará a comissão padrão do profissional.</p>'}</div></section>`:'';
  const productSettingsCard=canManageCommissionSettings()?`<section class="settings-card"><div class="section-title"><div><h3>Comissão de produtos</h3><small class="muted">Aplica-se aos produtos vinculados a um profissional na Comanda</small></div></div><form id="product-commission-settings"><label class="setting-row"><span><b>Ativar comissão sobre produtos</b><small>Produtos sem profissional vinculado não geram comissão</small></span><input type="checkbox" name="enabled" ${productCommissionEnabled?'checked':''}></label><label>Percentual de comissão (%)<input class="field" name="rate" type="number" min="0" max="100" step="0.01" value="${productCommissionRate.toFixed(2)}" required></label><button class="btn primary" type="submit">Salvar configuração</button></form></section>`:'';
  host.innerHTML=`
   ${serviceRulesCard}
   ${productSettingsCard}
   <section class="settings-card commission-summary"><div><small class="eyebrow">A PAGAR</small><h2>${money(pending)}</h2></div><div><small class="eyebrow">PAGO</small><h2>${money(paid)}</h2></div><div><small class="eyebrow">LANÇAMENTOS</small><h2>${visible.length}</h2></div></section><div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="commission-professional-search" placeholder="Filtrar por profissional" autocomplete="off"></label><button class="btn secondary" data-clear-commission-filter>Todos</button></div><div id="commission-groups">${sections||'<div class="empty-state">Nenhuma comissão foi gerada. Os lançamentos são criados proporcionalmente conforme os pagamentos da Comanda são recebidos.</div>'}</div><div class="section-title section-title--spaced"><h2>Histórico de pagamentos</h2><span class="result-count">${payouts.length} pagamento(s)</span></div><div class="record-list">${payoutHistory||'<div class="empty-state">Nenhum pagamento de comissão registrado.</div>'}</div>`;

  const searchInput=host.querySelector("#commission-professional-search");
  if(searchInput){
   cleanupSearch=mountAutocomplete(searchInput,{
    search:async term=>professionals.filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
    getLabel:item=>item.name,
    onSelect:item=>{selectedProfessionalFilter=item?.id||null;loadCommissionsPage();}
   });
  }

  bindCommissionEvents({host,state,supabase,toast,reportError,canPay,canManageCommissionSettings,money,refresh:loadCommissionsPage,clearFilter:()=>{selectedProfessionalFilter=null;}});
 }catch(error){
  if(!current())return;
  host._commissionConfig=null;
  reportError(error,{context:"Comissões > carregar dados"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar as comissões.</b><small>Atualize a página e tente novamente.</small></div>';
 }
}
