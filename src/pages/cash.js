/**
 * Caixa operacional — SALÃO PREMIUM.
 * Consulta e opera caixas por organização e filial; abertura/fechamento são RPCs transacionais.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { queryCashDashboard } from "../modules/cash/services/cash-query.service.js";
import { renderCashDashboard } from "../modules/cash/components/cash-dashboard.js";
import { openCashRegister, closeCashRegister } from "../modules/cash/services/cash-operations.js";

/** Renderiza a estrutura da página de Caixa e seu estado inicial de carregamento. */
export function cashPage(){
 return head("Caixa","Abertura, conferência e histórico dos recebimentos e saídas.")+
  '<div id="cash-manager"><div class="empty-state">Carregando movimentações do caixa…</div></div>';
}

/** Carrega os dados somente da unidade selecionada e conecta operações autorizadas. */
export async function loadCashPage(){
 const host=document.querySelector("#cash-manager");
 if(!host||!state.organization?.id)return;
 const orgId=state.organization.id,userId=state.user?.id,globalBranch=state.branch?.id||null;
 const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
 const current=()=>host.isConnected&&state.organization?.id===orgId&&state.user?.id===userId&&(state.branch?.id||null)===globalBranch&&host.dataset.request===request;
 const context=JSON.stringify([orgId,userId,globalBranch]);
 if(host.dataset.context!==context){delete host.dataset.branchId;host.dataset.context=context;}
 host.dataset.loadedOrgId="";
 host.textContent="Carregando movimentações do caixa…";
 try{
  const selectedBranchId=host.dataset.branchId!==undefined?host.dataset.branchId:(state.branch?.id||"");
  host.dataset.branchId=selectedBranchId;
  const result=await queryCashDashboard({supabase,orgId,selectedBranchId});
  if(!current())return;
  if(result.invalidBranch){host.dataset.branchId="";return loadCashPage();}
  const {branches,registers,movements,active,income,expense,net,activeNet,paymentMap,orderMap}=result;
  const history=movements.map(m=>{
   const payment=paymentMap.get(m.id),order=payment?.order||orderMap.get(m.service_order_id);
   const label=order?"Comanda #"+order.order_number+" · "+order.customerName:m.description;
   return '<article class="record-card cash-movement" data-method="'+esc(m.payment_method||"")+
'" data-date="'+String(m.created_at).slice(0,10)+
'" data-search="'+esc((label+" "+m.description).toLocaleLowerCase("pt-BR"))+
'"><span class="record-main"><b>'+esc(label)+
'</b><small>'+new Date(m.created_at).toLocaleString("pt-BR")+
' · '+esc(m.payment_method?({pix:"PIX",cash:"Dinheiro",credit_card:"Cartão de crédito",debit_card:"Cartão de débito",transfer:"Transferência",voucher:"Voucher",other:"Outro"}[m.payment_method]||"Outro"):(m.category||"Movimentação"))+
'</small></span><span class="record-trailing"><b>'+((m.movement_type==="expense"?"−":"+")+Number(m.amount||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}))+
'</b><small>'+esc(m.movement_type==="income"?"Entrada":m.movement_type==="expense"?"Saída":m.movement_type)+(payment?" · Pagamento individual":"")+
'</small></span></article>';
  }).join("");
  if(!current())return;
  host.dataset.activeRegisterId=active?.id||"";
  host.dataset.loadedOrgId=orgId;
  host.dataset.loadedBranchId=selectedBranchId;
  host.innerHTML=renderCashDashboard({
   active,activeNet,income,expense,net,movements,history,registers,branches,selectedBranchId,canOperate:["owner","admin","manager","receptionist","finance"].includes(state.membership?.role)
  });
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   const applyCashFilters=()=>{
    const term=String(host.querySelector("#cash-filter-search")?.value||"").trim().toLocaleLowerCase("pt-BR");
    const from=host.querySelector("#cash-filter-from")?.value||"",to=host.querySelector("#cash-filter-to")?.value||"",method=host.querySelector("#cash-filter-method")?.value||"";
    host.querySelectorAll(".cash-movement").forEach(row=>{row.hidden=Boolean((term&&!row.dataset.search.includes(term))||(from&&row.dataset.date<from)||(to&&row.dataset.date>to)||(method&&row.dataset.method!==method));});
   };
   host.addEventListener("input",event=>{if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();});
   host.addEventListener("change",async event=>{
    if(event.target.matches("#cash-branch-select")){
     host.dataset.branchId=String(event.target.value||"");
     await loadCashPage();
     return;
    }
    if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();
   });
   host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#cash-open-form")&&!form.matches("#cash-close-form"))return;
    event.preventDefault();
    if(!["owner","admin","manager","receptionist","finance"].includes(state.membership?.role)){toast("Seu perfil não pode operar o caixa.");return;}
    const button=form.querySelector('[type="submit"]');
    const orgId=state.organization?.id;
    if(!orgId||host.dataset.loadedOrgId!==orgId||host.dataset.loadedBranchId!==host.dataset.branchId||button.disabled)return;
    button.disabled=true;button.textContent="Salvando…";
    try{
     const values=new FormData(form);
     if(form.matches("#cash-open-form")){
      const {error}=await openCashRegister({supabase,orgId,branchId:host.dataset.branchId||null,openingAmount:values.get("opening_amount")});
      if(error)throw error;
      toast("Caixa aberto e registrado nesta unidade.");
     }else{
      const {data,error}=await closeCashRegister({supabase,cashRegisterId:host.dataset.activeRegisterId,closingAmount:values.get("closing_amount")});
      if(error)throw error;
      toast("Caixa fechado. Diferença: "+Number(data?.difference||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+".");
     }
     await loadCashPage();
    }catch(error){reportError(error,{context:"Caixa > operação"});}
    finally{if(button.isConnected){button.disabled=false;button.textContent=form.matches("#cash-open-form")?"Abrir caixa":"Conferir e fechar caixa";}}
   });
  }
 }catch(error){
  if(!current())return;
  reportError(error,{context:"Caixa > carregar movimentações"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar o Caixa.</b><small>Confira sua permissão e tente novamente.</small></div>';
 }
}
