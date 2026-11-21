/**
 * Eventos e modais do catálogo de serviços; recebe serviços por injeção.
 */
import { parseBRL, applyInputMask } from "../../utils/input-masks.js";
import { state } from "../../state.js";
/**
 * Abre o modal de cadastro ou edição e preenche os campos do serviço.
 * @param {object|null} service Serviço existente ou null para novo cadastro.
 * @returns {void} Exibe o modal e prepara a máscara monetária.
 */
function openServiceModal(service=null) {
  const dialog=document.querySelector("#service-create-modal");
  const form=dialog?.querySelector("#service-create-form");
  if(!dialog||!form)return;
  form.reset();
  form.elements.service_id.value=service?.id||"";
  form.elements.name.value=service?.name||"";
  const branchField=form.elements.branch_id;
  if(branchField){
    branchField.querySelectorAll("[data-legacy-branch]").forEach(option=>option.remove());
    if(service?.branch_id&&![...branchField.options].some(option=>option.value===service.branch_id)){
      const option=document.createElement("option");option.value=service.branch_id;option.textContent="Unidade vinculada (inativa)";option.dataset.legacyBranch="true";branchField.add(option);
    }
    branchField.value=service?.branch_id||"";
    // Alteração de escopo de serviço existente exige revisão dos vínculos históricos.
    branchField.disabled=Boolean(service);
  }
  const categoryField=form.elements.category;
  // Remove a opção temporária de uma edição anterior antes de abrir outro cadastro.
  if(categoryField.tagName==="SELECT")categoryField.querySelectorAll("[data-legacy-category]").forEach(option=>option.remove());
  if(categoryField.tagName==="SELECT"&&service?.category&&
     ![...categoryField.options].some(option=>option.value===service.category)) {
    const option=document.createElement("option");
    option.dataset.legacyCategory="true";
    option.value=service.category;
    option.textContent=service.category+" (inativa)";
    categoryField.add(option);
  }
  categoryField.value=service?.category||"";
  form.elements.duration.value=service?.duration_minutes??30;
  form.elements.price.value=Number(service?.price||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  form.elements.description.value=service?.description||"";
  applyInputMask(form.elements.price);
  const title=dialog.querySelector("#service-modal-title");
  const submit=form.querySelector('[type="submit"]');
  if(title)title.textContent=service?"Editar serviço":"Novo serviço";
  if(submit)submit.textContent=service?"Salvar alterações":"Cadastrar serviço";
  if(!dialog.open)dialog.showModal();
}


let modalListenerInstalled=false;
/**
 * Conecta eventos uma vez por montagem.
 * @param {object} options Estado, contexto, serviços e notificações.
 * @returns {void} Registra eventos do catálogo.
 */
export function bindServiceEvents({host,client,servicePageState,getOrgId,canManageServices,toast,reportError,saveService,setServiceActive,loadServicesPage}) {
  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!modalListenerInstalled) {
    modalListenerInstalled=true;
    document.addEventListener("click",event=>{
      const dialog=document.querySelector("#service-create-modal");
      if(!dialog)return;
      if(event.target.closest('[data-action="open-service-modal"]')&&canManageServices()) {
        const snapshot=servicePageState.current(document.querySelector("#services-manager"),getOrgId());
        if(snapshot&&!snapshot.pending)openServiceModal();
      }
      else if(event.target.closest("[data-close-service-modal]")||event.target===dialog) {
        if(dialog.open)dialog.close();
      }
    });
  }

  host.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit-service]");
    if(edit) {
      if(!canManageServices())return toast("Somente proprietário ou administrador pode editar serviços.");
      const snapshot=servicePageState.current(host,getOrgId());
      if(!snapshot||snapshot.pending)return;
      const row=snapshot?.rows.find(item=>item.id===edit.dataset.editService);
      if(!row)return toast("Registro não encontrado. Atualize a lista.");
      openServiceModal(row);
      return;
    }
    const toggle=event.target.closest("[data-toggle-service]");
    if(!toggle)return;
    if(!canManageServices())return toast("Somente proprietário ou administrador pode alterar serviços.");
    const snapshot=servicePageState.current(host,getOrgId());
    const row=snapshot?.rows.find(item=>item.id===toggle.dataset.toggleService);
    if(!row||toggle.disabled||snapshot.pending)return;
    const nextActive=!row.active;
    if(!window.confirm(nextActive?"Reativar este serviço?":"Inativar este serviço? O histórico será preservado."))return;
    if(!servicePageState.isCurrent(host,snapshot,getOrgId()))return;
    toggle.disabled=true;
    snapshot.pending=true;
    try {
      await setServiceActive({client,orgId:snapshot.orgId,branchId:state.branch?.id||null,serviceId:row.id,active:nextActive});
      if(!servicePageState.isCurrent(host,snapshot,getOrgId()))return;
      toast(nextActive?"Serviço reativado.":"Serviço inativado.");
      await loadServicesPage();
    } catch(error) {
      if(servicePageState.isCurrent(host,snapshot,getOrgId()))reportError(error,{context:"Serviços > alterar situação"});
    } finally {
      snapshot.pending=false;
      if(toggle.isConnected)toggle.disabled=false;
    }
  });

  host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#service-create-form"))return;
    event.preventDefault();
    if(!canManageServices())return toast("Somente proprietário ou administrador pode cadastrar serviços.");
    const values=new FormData(form);
    const submit=form.querySelector('[type="submit"]');
    const snapshot=servicePageState.current(host,getOrgId());
    const serviceId=String(values.get("service_id")||"").trim()||null;
    if(!snapshot||!submit||submit.disabled||snapshot.pending)return;
    if(serviceId&&!snapshot.rows.some(row=>row.id===serviceId))return toast("Registro não encontrado. Atualize a lista.");
    const name=String(values.get("name")||"").trim();
    const duration=Number(values.get("duration"));
    const price=parseBRL(values.get("price"));
    if(!name||!Number.isFinite(duration)||duration<5||duration>720||
       !Number.isFinite(price)||price<0) {
      toast("Confira o nome, duração e preço do serviço.");
      return;
    }
    submit.disabled=true;
    snapshot.pending=true;
    try {
      await saveService({
        client,orgId:snapshot.orgId,
        serviceId,branchId:serviceId?(state.branch?.id||null):(values.get("branch_id")||null),
        name,category:values.get("category"),durationMinutes:duration,
        price,description:values.get("description")
      });
      if(!servicePageState.isCurrent(host,snapshot,getOrgId()))return;
      host.querySelector("#service-create-modal")?.close();
      toast(values.get("service_id")?"Serviço atualizado.":"Serviço cadastrado.");
      await loadServicesPage();
    } catch(error) {
      if(servicePageState.isCurrent(host,snapshot,getOrgId()))reportError(error,{context:"Serviços > salvar cadastro"});
    } finally {
      snapshot.pending=false;
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
