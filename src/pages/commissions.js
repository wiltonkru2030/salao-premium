import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { mountAutocomplete } from "../components/autocomplete.js";
import { reportError } from "../utils/errors.js";

let cleanupSearch=null;
let selectedProfessionalFilter=null;
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=value=>value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
const statusLabel=value=>({pending:"Pendente",approved:"Aprovada",paid:"Paga",cancelled:"Cancelada"})[value]||value;
const canPay=()=>["owner","admin","manager","finance"].includes(state.membership?.role);

export function commissionsPage(){
 selectedProfessionalFilter=null;
 return head("Comissões","Valores gerados pelos atendimentos, histórico e pagamentos aos profissionais.")+
  '<div id="commissions-manager"><div class="empty-state">Carregando comissões do banco…</div></div>';
}

export async function loadCommissionsPage(){
 const host=document.querySelector("#commissions-manager");
 if(!host||!state.organization?.id)return;
 cleanupSearch?.();cleanupSearch=null;
 try{
  const orgId=state.organization.id;
  const [commissionResult,professionalResult,payoutResult]=await Promise.all([
   supabase.from("commissions").select("id,professional_id,base_amount,rate,amount,status,paid_at,created_at,payout_id,sale_id,appointment_id")
    .eq("org_id",orgId).order("created_at",{ascending:false}).limit(1000),
   supabase.from("professionals").select("id,name,active").eq("org_id",orgId).order("name").limit(500),
   supabase.from("commission_payouts").select("id,professional_id,amount,payment_method,paid_at,notes,cash_movement_id")
    .eq("org_id",orgId).order("paid_at",{ascending:false}).limit(300)
  ]);
  if(commissionResult.error)throw commissionResult.error;
  if(professionalResult.error)throw professionalResult.error;
  if(payoutResult.error)throw payoutResult.error;
  const commissions=commissionResult.data||[],professionals=professionalResult.data||[],payouts=payoutResult.data||[];
  const professionalMap=new Map(professionals.map(p=>[p.id,p]));
  const visible=selectedProfessionalFilter?commissions.filter(c=>c.professional_id===selectedProfessionalFilter):commissions;
  const totals=visible.reduce((acc,c)=>{acc[c.status]=(acc[c.status]||0)+Number(c.amount||0);return acc;},{});
  const pending=Number(totals.pending||0)+Number(totals.approved||0),paid=Number(totals.paid||0);
  const groups=new Map();
  for(const commission of visible){
   const current=groups.get(commission.professional_id)||[];
   current.push(commission);groups.set(commission.professional_id,current);
  }
  const sections=[...groups.entries()].map(([professionalId,rows])=>{
   const professional=professionalMap.get(professionalId),eligible=rows.filter(c=>["pending","approved"].includes(c.status)&&!c.payout_id);
   return '<section class="settings-card commission-group"><div class="section-title"><div><h3>'+esc(professional?.name||"Profissional")+'</h3><small class="muted">'+rows.length+' lançamento(s) · '+money(rows.reduce((sum,c)=>sum+Number(c.amount||0),0))+'</small></div></div>'+
    rows.map(c=>'<div class="setting-row commission-row"><label class="commission-select">'+(canPay()&&eligible.some(x=>x.id===c.id)?'<input type="checkbox" data-commission-select="'+c.id+'" data-professional-id="'+professionalId+'">':'<span class="commission-select-spacer"></span>')+
     '<span><b>'+money(c.amount)+'</b><small>Base '+money(c.base_amount)+' · '+Number(c.rate)+'% · '+dateTime(c.created_at)+'</small></span></label><span class="record-trailing"><b>'+esc(statusLabel(c.status))+'</b><small>'+(c.paid_at?'Pago em '+dateTime(c.paid_at):'')+'</small></span></div>').join("")+
    (canPay()&&eligible.length?'<div class="commission-payout-controls"><select class="field" data-payment-method="'+professionalId+'"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="other">Outro</option></select><button class="btn primary" type="button" data-pay-commissions="'+professionalId+'">Pagar selecionadas</button></div>':'')+
    '</section>';
  }).join("");
  const payoutHistory=payouts.map(p=>{
   const professional=professionalMap.get(p.professional_id);
   return '<article class="record-card"><span class="record-main"><b>'+esc(professional?.name||"Profissional")+' · '+money(p.amount)+'</b><small>'+dateTime(p.paid_at)+' · '+esc(p.payment_method)+'</small><small>'+esc(p.notes||"Pagamento de comissões")+'</small></span><span class="record-trailing"><small>Pago</small><small>Caixa vinculado</small></span></article>';
  }).join("");
  host.innerHTML=`
   <section class="settings-card commission-summary"><div><small class="eyebrow">A PAGAR</small><h2>${money(pending)}</h2></div><div><small class="eyebrow">PAGO</small><h2>${money(paid)}</h2></div><div><small class="eyebrow">LANÇAMENTOS</small><h2>${visible.length}</h2></div></section>
   <div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="commission-professional-search" placeholder="Filtrar por profissional" autocomplete="off"></label><button class="btn secondary" data-clear-commission-filter>Todos</button></div>
   <div id="commission-groups">${sections||'<div class="empty-state">Nenhuma comissão foi gerada. As comissões são criadas quando uma comanda é quitada.</div>'}</div>
   <div class="section-title section-title--spaced"><h2>Histórico de pagamentos</h2><span class="result-count">${payouts.length} pagamento(s)</span></div>
   <div class="record-list">${payoutHistory||'<div class="empty-state">Nenhum pagamento de comissão registrado.</div>'}</div>`;

  const searchInput=host.querySelector("#commission-professional-search");
  if(searchInput){
   cleanupSearch=mountAutocomplete(searchInput,{
    search:async term=>professionals.filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
    getLabel:item=>item.name,
    onSelect:item=>{selectedProfessionalFilter=item?.id||null;loadCommissionsPage();}
   });
  }
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   host.addEventListener("click",async event=>{
    if(event.target.closest("[data-clear-commission-filter]")){
     selectedProfessionalFilter=null;await loadCommissionsPage();return;
    }
    const button=event.target.closest("[data-pay-commissions]");
    if(!button)return;
    if(!canPay()){toast("Seu perfil não pode efetuar pagamentos de comissão.");return;}
    const professionalId=button.dataset.payCommissions;
    const checked=[...host.querySelectorAll('[data-commission-select]:checked')].filter(input=>input.dataset.professionalId===professionalId);
    const ids=checked.map(input=>input.dataset.commissionSelect);
    if(!ids.length){toast("Selecione as comissões que deseja pagar.");return;}
    const method=host.querySelector('[data-payment-method="'+professionalId+'"]')?.value||"pix";
    const name=professionalMap.get(professionalId)?.name||"profissional";
    const amount=visible.filter(c=>ids.includes(c.id)).reduce((sum,c)=>sum+Number(c.amount||0),0);
    if(!window.confirm("Confirmar pagamento de "+money(amount)+" para "+name+"? O lançamento será registrado como saída no Caixa."))return;
    button.disabled=true;button.textContent="Registrando…";
    let payment;
    try {
     payment=await supabase.rpc("pay_professional_commissions",{
      p_org_id:orgId,p_professional_id:professionalId,p_commission_ids:ids,
      p_payment_method:method,p_notes:"Pagamento de comissões"
     });
     if(payment.error)throw payment.error;
    } catch(error) {
     reportError(error,{context:"Comissões > registrar pagamento"});
     button.disabled=false;button.textContent="Pagar selecionadas";return;
    }
    toast(money(payment.data?.amount)+" pago. Caixa e histórico atualizados.");await loadCommissionsPage();
   });
  }
 }catch(error){
  reportError(error,{context:"Comissões > carregar dados"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar as comissões.</b><small>Atualize a página e tente novamente.</small></div>';
 }
}
