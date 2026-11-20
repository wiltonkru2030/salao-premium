/**
 * Módulo: Serviços.
 * Responsabilidade: apresentar o catálogo e administrar cadastro, edição e inativação.
 * Integração: serviços alimentam Agenda, Comandas, App Profissional e App da Cliente.
 * Segurança: somente owner/admin altera; o serviço e RLS repetem a validação.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, btn } from "../utils.js";
import { bindServiceEvents } from "../modules/catalog/services.controller.js";
import { renderServicesView } from "../modules/catalog/services.view.js";
import { reportError } from "../utils/errors.js";
import { listServices, saveService, setServiceActive } from "../modules/catalog/services.service.js";
import { listCatalogCategories } from "../modules/catalog/categories.service.js";

import { listBranches } from "../modules/branches/branches.service.js";
import { createCatalogPageState } from "../modules/catalog/catalog-page-state.js";

const servicePageState=createCatalogPageState();
const canManageServices=()=>["owner","admin"].includes(state.membership?.role);

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
  const orgId=state.organization.id;
  const request=servicePageState.begin(host,orgId);
  host.textContent="Carregando serviços…";
  let services,branches;
  let serviceCategories=null;
  try {
    [services,branches]=await Promise.all([listServices({client:supabase,orgId}),listBranches({client:supabase,orgId})]);
    try {
      serviceCategories=await listCatalogCategories({
        client:supabase,orgId,categoryType:"service",activeOnly:true
      });
    } catch(categoryError) {
      if(["PGRST202","PGRST205","42P01","42883"].includes(categoryError?.code))serviceCategories=null;
      else throw categoryError;
    }
    if(!servicePageState.commit(host,request,state.organization?.id,services))return;
    host.innerHTML=renderServicesView(services,serviceCategories,canManageServices(),branches);
  } catch(error) {
    if(!servicePageState.isCurrent(host,request,state.organization?.id))return;
    reportError(error,{context:"Serviços > carregar lista"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar os serviços. Atualize a página e tente novamente.</div>';
    return;
  }

  bindServiceEvents({
    host,client:supabase,servicePageState,getOrgId:()=>state.organization?.id,
    canManageServices,toast,reportError,saveService,setServiceActive,loadServicesPage
  });
}
