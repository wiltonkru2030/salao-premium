/**
 * Módulo: Clientes.
 * Responsabilidade: consultar, cadastrar, editar e inativar clientes da organização ativa.
 * Integração: Agenda, Orçamentos, Comandas e histórico do salão utilizam estes cadastros.
 * Segurança: o serviço filtra org_id; as políticas RLS validam o papel em cada operação.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { listCustomers, saveCustomer, setCustomerActive } from "../modules/customers/customers.service.js";

import { createCustomerPageState } from "../modules/customers/customer-page-state.js";

const customerPageState=createCustomerPageState();

/** Retorna a chave da organização e unidade ativas para invalidar respostas antigas. */
function customerContextKey(){
  return JSON.stringify([state.organization?.id||null,state.branch?.id||null]);
}
let modalListenerInstalled=false;

/** Papéis autorizados pelas políticas de leitura, inclusão e atualização da tabela customers. */
const canManageCustomers=()=>["owner","admin","manager","receptionist"].includes(state.membership?.role);

/**
 * Abre o modal de cadastro/edição e preenche os campos do cliente.
 * @param {object|null} customer Cliente existente ou null para novo cadastro.
 * @returns {void} Exibe o modal e configura o texto da ação.
 */
function openCustomerModal(customer=null) {
  const dialog=document.querySelector("#customer-create-modal");
  const form=dialog?.querySelector("#customer-create-form");
  if(!dialog||!form)return;
  form.reset();
  form.elements.customer_id.value=customer?.id||"";
  form.elements.name.value=customer?.name||"";
  form.elements.phone.value=customer?.phone||"";
  form.elements.email.value=customer?.email||"";
  form.elements.birth_date.value=customer?.birth_date||"";
  const title=dialog.querySelector("#customer-modal-title");
  const submit=form.querySelector('[type="submit"]');
  if(title)title.textContent=customer?"Editar cliente":"Novo cliente";
  if(submit)submit.textContent=customer?"Salvar alterações":"Cadastrar cliente";
  if(!dialog.open)dialog.showModal();
}

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
  let customers;
  try {
    customers=await listCustomers({client:supabase,orgId,branchId});
    if(!customerPageState.commit(host,request,customerContextKey(),customers))return;
  } catch(error) {
    if(!customerPageState.isCurrent(host,request,customerContextKey()))return;
    reportError(error,{context:"Clientes > carregar lista"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar os clientes. Atualize a página e tente novamente.</div>';
    return;
  }

  const cards=customers.map(customer=>{
    const actions=canManageCustomers()
      ? '<button class="btn secondary" type="button" data-edit-customer="'+esc(customer.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-customer="'+esc(customer.id)+'" data-active="'+(customer.active?"true":"false")+'">'+(customer.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(customer.name)+'</b>'+
      '<small>'+esc(customer.phone||"Telefone não informado")+'</small>'+
      '<small>'+esc(customer.email||"")+'</small></span>'+
      '<span class="record-trailing"><small class="status-pill '+(customer.active?"active":"inactive")+'">'+(customer.active?"Ativo":"Inativo")+'</small>'+actions+'</span></article>';
  }).join("");

  host.innerHTML=
    '<dialog class="sp-modal" id="customer-create-modal" aria-labelledby="customer-modal-title">'+
      '<div class="sp-modal-shell"><header class="sp-modal-head"><div><h2 id="customer-modal-title">Novo cliente</h2><p>Informe os dados para adicionar à base de clientes.</p></div>'+
      '<button class="sp-modal-close" type="button" data-close-customer-modal aria-label="Fechar">×</button></header>'+
      '<form id="customer-create-form"><input type="hidden" name="customer_id"><div class="sp-modal-body">'+
      '<label class="sp-span">Nome completo<input name="name" required minlength="2" maxlength="120" placeholder="Nome do cliente" autocomplete="name"></label>'+
      '<label>Telefone<input name="phone" type="tel" data-mask="phone" placeholder="(00) 00000-0000" autocomplete="tel"></label>'+
      '<label>E-mail<input name="email" type="email" maxlength="254" placeholder="cliente@email.com" autocomplete="email"></label>'+
      '<label>Data de nascimento<input name="birth_date" type="date"></label>'+
      '</div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-customer-modal>Cancelar</button>'+
      '<button class="btn primary" type="submit">Cadastrar cliente</button></footer></form></div></dialog>'+
    '<div class="list-toolbar"><span class="result-count">'+customers.length+' clientes</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhum cliente cadastrado.</div>')+'</div>';

  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!modalListenerInstalled) {
    modalListenerInstalled=true;
    document.addEventListener("click",event=>{
      const dialog=document.querySelector("#customer-create-modal");
      if(!dialog)return;
      if(event.target.closest('[data-action="open-customer-modal"]')&&canManageCustomers()) {
        const currentHost=document.querySelector("#customers-manager");
        if(customerPageState.current(currentHost,customerContextKey()))openCustomerModal();
      }
      else if(event.target.closest("[data-close-customer-modal]")||event.target===dialog) {
        if(dialog.open)dialog.close();
      }
    });
  }

  host.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit-customer]");
    if(edit) {
      if(!canManageCustomers())return toast("Seu perfil não pode editar clientes.");
      const snapshot=customerPageState.current(host,customerContextKey());
      const customer=snapshot?.customers.find(row=>row.id===edit.dataset.editCustomer);
      if(!customer)return toast("Cliente não encontrado. Atualize a lista.");
      openCustomerModal(customer);
      return;
    }
    const toggle=event.target.closest("[data-toggle-customer]");
    if(!toggle)return;
    if(!canManageCustomers())return toast("Seu perfil não pode alterar clientes.");
    const snapshot=customerPageState.current(host,customerContextKey());
    const customer=snapshot?.customers.find(row=>row.id===toggle.dataset.toggleCustomer);
    if(!customer||toggle.disabled)return;
    const nextActive=!customer.active;
    if(!window.confirm(nextActive?"Reativar este cliente?":"Inativar este cliente? O histórico de atendimentos será preservado."))return;
    toggle.disabled=true;
    try {
      await setCustomerActive({client:supabase,orgId:state.organization.id,customerId:customer.id,active:nextActive});
      if(!customerPageState.isCurrent(host,snapshot,customerContextKey()))return;
      toast(nextActive?"Cliente reativado.":"Cliente inativado.");
      await loadCustomersPage();
    } catch(error) {
      if(customerPageState.isCurrent(host,snapshot,customerContextKey()))reportError(error,{context:"Clientes > alterar situação"});
    } finally {
      if(toggle.isConnected)toggle.disabled=false;
    }
  });

  host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#customer-create-form"))return;
    event.preventDefault();
    if(!canManageCustomers())return toast("Seu perfil não pode cadastrar clientes.");
    const values=new FormData(form);
    const submit=form.querySelector('[type="submit"]');
    const customerId=String(values.get("customer_id")||"").trim()||null;
    const snapshot=customerPageState.current(host,customerContextKey());
    if(!snapshot||!submit||submit.disabled)return;
    if(customerId&&!snapshot.customers.some(row=>row.id===customerId))return toast("Cliente não encontrado. Atualize a lista.");
    submit.disabled=true;
    try {
      await saveCustomer({
        client:supabase,orgId:state.organization.id,branchId:state.branch?.id||null,customerId,
        name:values.get("name"),phone:values.get("phone"),
        email:values.get("email"),birthDate:values.get("birth_date")
      });
      if(!customerPageState.isCurrent(host,snapshot,customerContextKey()))return;
      host.querySelector("#customer-create-modal")?.close();
      toast(customerId?"Cliente atualizado.":"Cliente cadastrado.");
      await loadCustomersPage();
    } catch(error) {
      if(customerPageState.isCurrent(host,snapshot,customerContextKey()))reportError(error,{context:"Clientes > salvar cadastro"});
    } finally {
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
