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
import { bindCashEvents } from "../modules/cash/controllers/cash.controller.js";

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
  bindCashEvents({host,state,supabase,toast,reportError,refresh:loadCashPage});
 }catch(error){
  if(!current())return;
  reportError(error,{context:"Caixa > carregar movimentações"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar o Caixa.</b><small>Confira sua permissão e tente novamente.</small></div>';
 }
}
