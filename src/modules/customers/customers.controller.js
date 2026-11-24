/**
 * Controlador de eventos da carteira de clientes.
 * Responsabilidade: conectar modal, ações e submissões ao serviço injetado.
 * Não contém marcação HTML ou consultas diretas ao banco.
 */
import {formatSavedPhone} from "../../utils/input-masks.js";
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
  form.elements.phone.value=formatSavedPhone(customer?.phone);
  form.elements.email.value=customer?.email||"";
  form.elements.birth_date.value=customer?.birth_date||"";
  const title=dialog.querySelector("#customer-modal-title");
  const submit=form.querySelector('[type="submit"]');
  if(title)title.textContent=customer?"Editar cliente":"Novo cliente";
  if(submit)submit.textContent=customer?"Salvar alterações":"Cadastrar cliente";
  if(!dialog.open)dialog.showModal();
}


let modalListenerInstalled=false;

/**
 * Conecta os eventos uma única vez por montagem.
 * @param {object} options Dependências da página, serviços, contexto e notificações.
 * @returns {void} Registra ações de cadastro, edição e alteração de situação.
 */
export function bindCustomerEvents({host,client,customerPageState,customerContextKey,getContext,canManageCustomers,toast,reportError,saveCustomer,setCustomerActive,loadCustomersPage}) {
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
    // Captura o contexto antes da confirmação para evitar gravação em outra unidade.
    const context=getContext();
    const nextActive=!customer.active;
    if(!window.confirm(nextActive?"Reativar este cliente?":"Inativar este cliente? O histórico de atendimentos será preservado."))return;
    if(!customerPageState.isCurrent(host,snapshot,customerContextKey()))return;
    toggle.disabled=true;
    try {
      await setCustomerActive({client,orgId:context.orgId,branchId:context.branchId,customerId:customer.id,active:nextActive});
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
    // Mantém o contexto original durante toda a operação assíncrona.
    const context=getContext();
    submit.disabled=true;
    try {
      await saveCustomer({
        client,orgId:context.orgId,branchId:context.branchId,customerId,
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
