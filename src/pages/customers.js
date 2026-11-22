/**
 * Módulo: Clientes.
 * Responsabilidade: consultar, cadastrar, editar e inativar clientes da organização ativa.
 * Integração: Agenda, Orçamentos, Comandas e histórico do salão utilizam estes cadastros.
 * Segurança: o serviço filtra org_id; as políticas RLS validam o papel em cada operação.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, btn } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { listCustomers, saveCustomer, setCustomerActive } from "../modules/customers/customers.service.js";

import { bindCustomerEvents } from "../modules/customers/customers.controller.js";
import { renderCustomersView, renderCustomersStatus } from "../modules/customers/customers.view.js";
import { createCustomerPageState } from "../modules/customers/customer-page-state.js";

const customerPageState=createCustomerPageState();

/** Identifica a sessão, organização, unidade e papel antes de aceitar dados assíncronos. */
function customerContextKey(){
  return JSON.stringify([state.user?.id||null,state.organization?.id||null,state.branch?.id||null,state.membership?.role||null]);
}

/** Papéis autorizados pelas políticas de leitura, inclusão e atualização da tabela customers. */
const canManageCustomers=()=>["owner","admin","manager","receptionist"].includes(state.membership?.role);

/** Renderiza a página de clientes e a ação de cadastro. */
export function customersPage() {
  return head("Clientes","Cadastre e mantenha os dados dos clientes em um único lugar.",
    canManageCustomers()?btn("＋ Novo cliente","open-customer-modal","primary"):"")+
    '<div id="customers-manager"><div class="empty-state">Carregando clientes…</div></div>';
}

/**
 * Carrega clientes paginados e conecta os eventos do modal uma única vez por montagem.
 * @returns {Promise<void>} Atualiza a lista e os estados de carregamento/erro.
 */
export async function loadCustomersPage() {
  const host=document.querySelector("#customers-manager");
  if(!host||!state.organization?.id)return;
  const orgId=state.organization.id;
  const branchId=state.branch?.id||null;
  const request=customerPageState.begin(host,customerContextKey());
  // Remove a listagem anterior imediatamente, inclusive em trocas de filial.
  host.innerHTML=renderCustomersStatus();
  host.onclick=event=>{
    if(event.target.closest?.('[data-retry-customers]'))void loadCustomersPage();
  };
  try {
    const customers=await listCustomers({client:supabase,orgId,branchId});
    if(!customerPageState.commit(host,request,customerContextKey(),customers))return;
    host.innerHTML=renderCustomersView(customers,canManageCustomers());
  } catch(error) {
    if(!customerPageState.isCurrent(host,request,customerContextKey()))return;
    reportError(error,{context:"Clientes > carregar lista"});
    host.innerHTML=renderCustomersStatus(true);
    return;
  }


  bindCustomerEvents({
    host,client:supabase,customerPageState,customerContextKey,
    getContext:()=>({orgId:state.organization?.id,branchId:state.branch?.id||null}),
    canManageCustomers,toast,reportError,saveCustomer,setCustomerActive,loadCustomersPage
  });
}
