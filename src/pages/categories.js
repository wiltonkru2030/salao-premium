/**
 * Módulo: Categorias do catálogo.
 * Responsabilidade: administrar categorias de serviços e produtos por organização.
 * Integração: renomear categoria sincroniza os textos legados de serviços/produtos via RPC.
 * Segurança: somente owner/admin grava; leitura é limitada a membros do tenant pela RLS.
 */
import {supabase} from "../supabase/client.js";
import {state} from "../state.js";
import {head,toast,btn} from "../utils.js";
import {reportError} from "../utils/errors.js";
import {listCatalogCategories,saveCatalogCategory,setCatalogCategoryActive} from "../modules/catalog/categories.service.js";

import {renderCategoriesView} from "../modules/catalog/categories.view.js";
import {bindCategoryEvents} from "../modules/catalog/categories.controller.js";
import {createCatalogPageState} from "../modules/catalog/catalog-page-state.js";

const categoryPageState=createCatalogPageState();
let selectedType="service";
const canManageCategories=()=>["owner","admin"].includes(state.membership?.role);

/**
 * Renderiza a página de administração das categorias.
 * @returns {string} HTML com abas, lista e ação de cadastro.
 */
export function categoriesPage() {
  return head("Categorias","Organize serviços e produtos em grupos reutilizáveis.",
    canManageCategories()?btn("＋ Nova categoria","open-category-modal","primary"):"")+
    '<div id="categories-manager"><div class="empty-state">Carregando categorias…</div></div>';
}

/** Atualiza a interface com os dados do contexto ativo. */
function renderCategoryManager(host,categories) {
  host.innerHTML=renderCategoriesView(categories,selectedType,canManageCategories());
}

/**
 * Carrega categorias de ambos os catálogos e conecta ações uma única vez.
 * @returns {Promise<void>} Atualiza a lista e trata falhas de leitura.
 */
export async function loadCategoriesPage() {
  const host=document.querySelector("#categories-manager");
  if(!host||!state.organization?.id)return;
  const orgId=state.organization.id;
  const request=categoryPageState.begin(host,orgId);
  host.textContent="Carregando categorias…";
  try {
    const categories=await listCatalogCategories({client:supabase,orgId});
    if(!categoryPageState.commit(host,request,state.organization?.id,categories))return;
    renderCategoryManager(host,categories);
  } catch(error) {
    if(!categoryPageState.isCurrent(host,request,state.organization?.id))return;
    reportError(error,{context:"Categorias > carregar"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar as categorias. Tente novamente mais tarde.</div>';
    return;
  }
  bindCategoryEvents({
    host,client:supabase,categoryPageState,getOrgId:()=>state.organization?.id,
    getSelectedType:()=>selectedType,setSelectedType:type=>{selectedType=type;},
    renderCategoryManager,canManageCategories,toast,reportError,
    saveCatalogCategory,setCatalogCategoryActive,loadCategoriesPage
  });
}
