/** Módulo Comanda. Responsabilidade: apresentar comandas, itens, pagamentos e cancelamentos; regras financeiras finais são executadas por RPCs transacionais no Supabase. */
import { queryComandaDetails } from '../modules/comanda/services/comanda-query.service.js';
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { bindComandaDetails } from "../modules/comanda/controllers/comanda-detail.controller.js";
import { userErrorMessage, reportError } from "../utils/errors.js";
import { buildComandaDetails } from "../modules/comanda/components/comanda-detail.js";
import { currency, statusLabel, paymentStatusLabel, paymentMethodLabel } from "../modules/comanda/comanda.formatters.js";
import { cancelComanda } from "../modules/comanda/services/comanda-operations.js";
import {createPaymentIntentStore} from "../modules/comanda/services/payment-intent.js";
const protectedPayments=import.meta.env?.VITE_COMANDA_PAYMENT_IDEMPOTENCY==="true";

/** @typedef {import("../types/tenant.types").TenantContext} TenantContext */
/** @typedef {import("../types/operations.types").ServiceOrderRecord} ServiceOrderRecord */
/** @typedef {import("../types/operations.types").ServiceOrderPaymentRecord} ServiceOrderPaymentRecord */

/** Módulo Comandas: consulta comandas, monta detalhes e executa lançamentos e pagamentos. */

let cleanup=[];
let selectedOrder=null;
let loadVersion=0;
let orderContext=null;
const escapeHtml=esc;
function clearAutocomplete(){cleanup.forEach(fn=>fn());cleanup=[];}
/** Renderiza a estrutura inicial da página de Comandas. */
export function comandaPage(){
 selectedOrder=null;
 return head("Comanda","Comandas criadas a partir da chegada do cliente, com serviços, produtos e pagamentos.")+

 '<div id="comanda-manager"><div class="empty-state">Carregando comandas…</div></div>';
}
// Confirma sessão e organização ativa antes de consultar comandas.
async function tenant(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error)throw error;
 if(!user||!state.organization?.id)throw new Error("Entre no sistema para acessar as comandas.");
 return {user,orgId:state.organization.id};
}
function canManage(){return ["owner","admin","manager","receptionist"].includes(state.membership?.role);}
function canPay(){return canManage()||state.membership?.professional_app_scope==="all";}
// Carrega itens, pagamentos, cliente, profissional e catálogo da comanda.
// Desenha detalhes e formulários de serviço, produto e pagamento.
function renderOrderDetails(host,order,data,orgId){
 const editable=["open","in_progress","partially_paid","awaiting_payment"].includes(order.status);
 const {items,payments,customer,professional,services,products,professionals}=data;
 const isProfessional=state.membership?.role==="professional";
 const canAddOwnService=isProfessional&&editable&&Boolean(order.assigned_professional_id)&&professionals.some(item=>item.id===order.assigned_professional_id);
 let paymentStore=null,pendingPayment=null,paymentStorageUnavailable=false;
 if(protectedPayments&&canPay()){
  try{
   if(!navigator.locks?.request)throw new Error("Navegador sem bloqueio de operações.");
   paymentStore=createPaymentIntentStore({storage:window.localStorage,organizationId:orgId,userId:state.user?.id,orderId:order.id});
   pendingPayment=paymentStore.read();
  }catch{paymentStorageUnavailable=true;paymentStore=null;}
 }
 const view=buildComandaDetails(order,data,{
  pendingPayment,paymentStorageUnavailable,
  canManage:canManage(),canPay:canPay(),canAddOwnService,isProfessional,
  canEditItems:editable&&["owner","admin","manager"].includes(state.membership?.role)&&!data.payments.some(p=>p.status==="confirmed"),
  canRefund:["owner","admin","manager","finance"].includes(state.membership?.role)
 });
 const {paid,balance,allowEdit,allowPay,canEditItems}=view;
 host.innerHTML=view.html;
 clearAutocomplete();
 const version=loadVersion,key=orderContext;
 const isCurrent=()=>host.isConnected&&version===loadVersion&&key===JSON.stringify([state.organization?.id,state.user?.id,state.branch?.id||null]);
 cleanup=bindComandaDetails({host,order,orgId,supabase,tenant,toast,reportError,isCurrent,refresh:()=>isCurrent()?loadComandaPage(order.id):Promise.resolve(),editable,allowEdit,allowPay,canEditItems,canAddOwnService,isProfessional,professionals,paymentStore,pendingPayment,protectedPayments,withPaymentLock:task=>navigator.locks.request(paymentStore.key,task)});
}
// Controla carregamento da lista ou dos detalhes de uma comanda.
/** Carrega a lista de Comandas ou os detalhes de uma Comanda específica, incluindo itens e pagamentos. */
/**
 * Carrega lista ou detalhe de uma Comanda do tenant autenticado.
 * @param {string|null} orderId Identificador da Comanda, quando a tela abre um detalhe.
 * @returns {Promise<void>} Renderiza dados; gravações financeiras são executadas por RPC.
 */
/** Carrega ou atualiza os detalhes da comanda selecionada, respeitando o tenant ativo. */
export async function loadComandaPage(orderId=null){
 const host=document.querySelector("#comanda-manager");if(!host)return;
 clearAutocomplete();
 const version=++loadVersion,expectedOrg=state.organization?.id,expectedUser=state.user?.id,expectedBranch=state.branch?.id||null;
 const key=JSON.stringify([expectedOrg,expectedUser,expectedBranch]);
 if(orderContext!==key){selectedOrder=null;orderContext=key;}
 const isCurrent=()=>host.isConnected&&version===loadVersion&&state.organization?.id===expectedOrg&&state.user?.id===expectedUser&&(state.branch?.id||null)===expectedBranch;
 host.textContent="Carregando comandas…";
 try{
  const {orgId}=await tenant();
  if(!isCurrent())return;
  if(orderId||selectedOrder){
   const {data:order,error}=await supabase.from("service_orders").select("id,order_number,status,total,subtotal,discount,notes,customer_id,assigned_professional_id,appointment_id,created_at,branch_id").eq("org_id",orgId).eq("id",orderId||selectedOrder).maybeSingle();
   if(error)throw error;if(!order)throw new Error("Comanda não encontrada.");
   const details=await queryComandaDetails({supabase,order,orgId,canPay:canPay(),canManage:canManage()});if(!isCurrent())return;selectedOrder=order.id;renderOrderDetails(host,order,details,orgId);return;
  }
  const {data:orders,error}=await supabase.from("service_orders").select("id,order_number,status,total,created_at,customer_id,assigned_professional_id").eq("org_id",orgId).order("created_at",{ascending:false}).limit(200);
  if(error)throw error;
  const customersIds=[...new Set((orders||[]).map(o=>o.customer_id).filter(Boolean))],professionalIds=[...new Set((orders||[]).map(o=>o.assigned_professional_id).filter(Boolean))];
  const [customers,professionals]=await Promise.all([
   customersIds.length?supabase.from("customers").select("id,name").eq("org_id",orgId).in("id",customersIds):Promise.resolve({data:[]}),
   professionalIds.length?supabase.from("professionals").select("id,name").eq("org_id",orgId).in("id",professionalIds):Promise.resolve({data:[]})
  ]);
  if(customers.error)throw new Error("Falha ao carregar clientes das comandas: "+userErrorMessage(customers.error));
  if(professionals.error)throw new Error("Falha ao carregar profissionais das comandas: "+userErrorMessage(professionals.error));
  if(!isCurrent())return;
  const customerMap=new Map((customers.data||[]).map(c=>[c.id,c.name])),professionalMap=new Map((professionals.data||[]).map(p=>[p.id,p.name]));
  host.innerHTML='<div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="comanda-search" placeholder="Buscar cliente, profissional ou número"></label><span class="result-count">'+(orders?.length||0)+
' comandas</span></div>'+

   '<div class="record-list">'+(orders||[]).map(o=>'<button class="record-card" data-open-comanda="'+esc(o.id)+
'"><span class="record-main"><b>Comanda #'+esc(o.order_number)+
'</b><small>'+esc(customerMap.get(o.customer_id)||"Cliente não informado")+
'</small><small>'+esc(professionalMap.get(o.assigned_professional_id)||"Sem profissional")+
'</small></span><span class="record-trailing"><b>'+currency(o.total)+
'</b><small>'+esc(statusLabel(o.status))+
'</small></span><span class="record-chevron">›</span></button>').join("")+(orders?.length?"":'<div class="empty-state">Nenhuma comanda aberta. A comanda é criada quando o cliente chega e o atendimento começa na Agenda.</div>')+
'</div>';
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   host.addEventListener("click",async e=>{
    const open=e.target.closest("[data-open-comanda]");if(open){selectedOrder=open.dataset.openComanda;await loadComandaPage(selectedOrder);return;}
    if(e.target.closest('[data-action="back-comandas"]')){selectedOrder=null;await loadComandaPage();return;}
    if(e.target.closest('[data-action="cancel-comanda"]')){
     const button=e.target.closest('[data-action="cancel-comanda"]');
     if(button.disabled)return;
     const refund=button.dataset.refundPayments==="true";
     const message=refund
      ?"A comanda será cancelada e todos os pagamentos parciais serão estornados como saídas no Caixa. Deseja continuar?"
      :"Cancelar esta comanda e os agendamentos vinculados? Esta ação não pode ser desfeita.";
     if(!window.confirm(message))return;
     button.disabled=true;button.textContent="Processando…";
     try{
      const {data,error}=await cancelComanda({supabase,orderId:button.dataset.orderId,refundPayments:refund});
      if(error)throw error;
      toast(refund
       ?"Comanda cancelada. "+currency(data?.refunded_amount||0)+
" estornados e registrados no Caixa."
       :"Comanda e horários vinculados cancelados.");
      selectedOrder=null;await loadComandaPage();
     }catch(error){reportError(error,{context:"Comanda > cancelar e estornar"});button.disabled=false;button.textContent=refund?"Estornar recebimentos e cancelar comanda":"Cancelar comanda e horários vinculados";}
    }
   });
   host.addEventListener("input",e=>{
    if(!e.target.matches("#comanda-search"))return;const q=e.target.value.toLocaleLowerCase("pt-BR");
    host.querySelectorAll("[data-open-comanda]").forEach(card=>card.style.display=card.textContent.toLocaleLowerCase("pt-BR").includes(q)?"":"none");
   });
  }
 }catch(error){if(!isCurrent())return;reportError(error,{context:"Comanda > carregar dados"});host.innerHTML='<div class="empty-state">Não foi possível carregar as comandas. Atualize a página e tente novamente.</div>';}
}
