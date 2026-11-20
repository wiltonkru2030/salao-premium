/** Módulo Comissões. Responsabilidade: consultar comissões, registrar pagamentos autorizados e exibir histórico. */
import {renderCommissionsView} from "../modules/commissions/commissions.view.js";
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
  host.innerHTML=renderCommissionsView({visible,professionalMap,commissionOrderMap,commissionItemMap,commissionPaymentMap,payouts,professionals,services,serviceRules,serviceMap,productCommissionEnabled,productCommissionRate,canPay:canPay(),canManageCommissionSettings:canManageCommissionSettings()});

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
