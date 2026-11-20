/**
 * Módulo: Serviços.
 * Responsabilidade: apresentar o catálogo e administrar cadastro, edição e inativação.
 * Integração: serviços alimentam Agenda, Comandas, App Profissional e App da Cliente.
 * Segurança: somente owner/admin altera; o serviço e RLS repetem a validação.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL, applyInputMask } from "../utils/input-masks.js";
import { reportError } from "../utils/errors.js";
import { listServices, saveService, setServiceActive } from "../modules/catalog/services.service.js";
import { listCatalogCategories } from "../modules/catalog/categories.service.js";

let modalListenerInstalled=false;
let serviceCategories=null;
const canManageServices=()=>["owner","admin"].includes(state.membership?.role);
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

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
  const categoryField=form.elements.category;
  if(categoryField.tagName==="SELECT"&&service?.category&&
     ![...categoryField.options].some(option=>option.value===service.category)) {
    const option=document.createElement("option");
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

/** Renderiza a página de serviços e a ação de cadastro. */
export function servicesPage() {
  return head("Serviços","Cadastre os serviços disponíveis na agenda, nas comandas e nos aplicativos.",
    canManageServices()?btn("＋ Novo serviço","open-service-modal","primary"):"")+
    '<div id="services-manager"><div class="empty-state">Carregando serviços…</div></div>';
}

/**
 * Carrega o catálogo do tenant e instala eventos delegados uma única vez.
 * @returns {Promise<void>} Atualiza a lista e os estados de carregamento/erro.
 */
export async function loadServicesPage() {
  const host=document.querySelector("#services-manager");
  if(!host||!state.organization?.id)return;
  let services;
  try {
    services=await listServices({client:supabase,orgId:state.organization.id});
    try {
      serviceCategories=await listCatalogCategories({
        client:supabase,orgId:state.organization.id,categoryType:"service",activeOnly:true
      });
    } catch(categoryError) {
      if(["PGRST202","PGRST205","42P01","42883"].includes(categoryError?.code))serviceCategories=null;
      else throw categoryError;
    }
  } catch(error) {
    reportError(error,{context:"Serviços > carregar lista"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar os serviços. Atualize a página e tente novamente.</div>';
    return;
  }

  const cards=services.map(service=>{
    const actions=canManageServices()
      ? '<button class="btn secondary" type="button" data-edit-service="'+esc(service.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-service="'+esc(service.id)+'" data-active="'+(service.active?"true":"false")+'">'+(service.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(service.name)+'</b>'+
      '<small>'+esc(service.category||"Sem categoria")+' · '+Number(service.duration_minutes)+' min</small></span>'+
      '<span class="record-trailing"><b>'+money(service.price)+'</b>'+
      '<small class="status-pill '+(service.active?"active":"inactive")+'">'+(service.active?"Ativo":"Inativo")+'</small>'+actions+
      '</span></article>';
  }).join("");

  host.innerHTML=
    '<dialog class="sp-modal" id="service-create-modal" aria-labelledby="service-modal-title">'+
      '<div class="sp-modal-shell"><header class="sp-modal-head"><div><h2 id="service-modal-title">Novo serviço</h2><p>Defina nome, categoria, duração e preço.</p></div>'+
      '<button class="sp-modal-close" type="button" data-close-service-modal aria-label="Fechar">×</button></header>'+
      '<form id="service-create-form"><input type="hidden" name="service_id"><div class="sp-modal-body">'+
      '<label class="sp-span">Nome do serviço<input name="name" required maxlength="120" placeholder="Ex.: Corte feminino"></label>'+
      (Array.isArray(serviceCategories)
        ? '<label>Categoria<select name="category"><option value="">Sem categoria</option>'+serviceCategories.map(category=>'<option value="'+esc(category.name)+'">'+esc(category.name)+'</option>').join("")+'</select></label>'
        : '<label>Categoria<input name="category" maxlength="80" placeholder="Categoria (opcional)"></label>')+
      '<label>Duração (minutos)<input name="duration" type="number" min="5" max="720" step="5" value="30" required></label>'+
      '<label>Preço (R$)<input name="price" type="text" inputmode="decimal" data-mask="currency" value="0,00" required></label>'+
      '<label class="sp-span">Descrição<textarea name="description" rows="3" maxlength="500" placeholder="Detalhes opcionais do serviço"></textarea></label>'+
      '</div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-service-modal>Cancelar</button>'+
      '<button class="btn primary" type="submit">Cadastrar serviço</button></footer></form></div></dialog>'+
    '<div class="list-toolbar"><span class="result-count">'+services.length+' serviços</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhum serviço cadastrado.</div>')+'</div>';

  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!modalListenerInstalled) {
    modalListenerInstalled=true;
    document.addEventListener("click",event=>{
      const dialog=document.querySelector("#service-create-modal");
      if(!dialog)return;
      if(event.target.closest('[data-action="open-service-modal"]')&&canManageServices())openServiceModal();
      else if(event.target.closest("[data-close-service-modal]")||event.target===dialog) {
        if(dialog.open)dialog.close();
      }
    });
  }

  host.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit-service]");
    if(edit) {
      if(!canManageServices())return toast("Somente proprietário ou administrador pode editar serviços.");
      openServiceModal(services.find(service=>service.id===edit.dataset.editService)||null);
      return;
    }
    const toggle=event.target.closest("[data-toggle-service]");
    if(!toggle)return;
    if(!canManageServices())return toast("Somente proprietário ou administrador pode alterar serviços.");
    const nextActive=toggle.dataset.active!=="true";
    if(!window.confirm(nextActive?"Reativar este serviço?":"Inativar este serviço? O histórico será preservado."))return;
    toggle.disabled=true;
    try {
      await setServiceActive({client:supabase,orgId:state.organization.id,serviceId:toggle.dataset.toggleService,active:nextActive});
      toast(nextActive?"Serviço reativado.":"Serviço inativado.");
      await loadServicesPage();
    } catch(error) {
      reportError(error,{context:"Serviços > alterar situação"});
    } finally {
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
    const name=String(values.get("name")||"").trim();
    const duration=Number(values.get("duration"));
    const price=parseBRL(values.get("price"));
    if(!name||!Number.isFinite(duration)||duration<5||duration>720||
       !Number.isFinite(price)||price<0) {
      toast("Confira o nome, duração e preço do serviço.");
      return;
    }
    submit.disabled=true;
    try {
      await saveService({
        client:supabase,orgId:state.organization.id,
        serviceId:String(values.get("service_id")||"").trim()||null,
        name,category:values.get("category"),durationMinutes:duration,
        price,description:values.get("description")
      });
      document.querySelector("#service-create-modal")?.close();
      toast(values.get("service_id")?"Serviço atualizado.":"Serviço cadastrado.");
      await loadServicesPage();
    } catch(error) {
      reportError(error,{context:"Serviços > salvar cadastro"});
    } finally {
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
