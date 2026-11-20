/**
 * Módulo: Categorias do catálogo.
 * Responsabilidade: administrar categorias de serviços e produtos por organização.
 * Integração: renomear categoria sincroniza os textos legados de serviços/produtos via RPC.
 * Segurança: somente owner/admin grava; leitura é limitada a membros do tenant pela RLS.
 */
import {supabase} from "../supabase/client.js";
import {state} from "../state.js";
import {head,esc,toast,btn} from "../utils.js";
import {reportError} from "../utils/errors.js";
import {listCatalogCategories,saveCatalogCategory,setCatalogCategoryActive} from "../modules/catalog/categories.service.js";

import {createCatalogPageState} from "../modules/catalog/catalog-page-state.js";

const categoryPageState=createCatalogPageState();
let selectedType="service";
let documentListenerBound=false;
const canManageCategories=()=>["owner","admin"].includes(state.membership?.role);
const typeLabel=type=>type==="service"?"Serviços":"Produtos";

/**
 * Abre modal de criação/edição da categoria.
 * @param {object|null} category Categoria existente ou null para novo cadastro.
 * @returns {void} Preenche os campos e exibe o modal.
 */
function openCategoryModal(category=null) {
  const dialog=document.querySelector("#category-create-modal");
  const form=dialog?.querySelector("#category-create-form");
  if(!dialog||!form)return;
  form.reset();
  form.elements.category_id.value=category?.id||"";
  form.elements.category_type.value=category?.category_type||selectedType;
  form.elements.name.value=category?.name||"";
  const title=dialog.querySelector("#category-modal-title");
  const submit=form.querySelector('[type="submit"]');
  if(title)title.textContent=category?"Editar categoria":"Nova categoria";
  if(submit)submit.textContent=category?"Salvar alterações":"Cadastrar categoria";
  if(!dialog.open)dialog.showModal();
}

/**
 * Renderiza a página de administração das categorias.
 * @returns {string} HTML com abas, lista e ação de cadastro.
 */
export function categoriesPage() {
  return head("Categorias","Organize serviços e produtos em grupos reutilizáveis.",
    canManageCategories()?btn("＋ Nova categoria","open-category-modal","primary"):"")+
    '<div id="categories-manager"><div class="empty-state">Carregando categorias…</div></div>';
}

/** Renderiza o conteúdo atual a partir das categorias já carregadas. */
function renderCategoryManager(host,categories) {
  const visible=categories.filter(category=>category.category_type===selectedType);
  const cards=visible.map(category=>{
    const actions=canManageCategories()
      ? '<button class="btn secondary" type="button" data-edit-category="'+esc(category.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-category="'+esc(category.id)+'" data-active="'+(category.active?"true":"false")+'">'+(category.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(category.name)+'</b>'+
      '<small class="status-pill '+(category.active?"active":"inactive")+'">'+(category.active?"Ativa":"Inativa")+'</small></span>'+
      '<span class="record-trailing">'+actions+'</span></article>';
  }).join("");
  host.innerHTML=
    '<dialog class="sp-modal" id="category-create-modal" aria-labelledby="category-modal-title">'+
      '<div class="sp-modal-shell"><header class="sp-modal-head"><div><h2 id="category-modal-title">Nova categoria</h2><p>O nome atualizado será sincronizado nos itens já cadastrados.</p></div>'+
      '<button class="sp-modal-close" type="button" data-close-category-modal aria-label="Fechar">×</button></header>'+
      '<form id="category-create-form"><input type="hidden" name="category_id"><input type="hidden" name="category_type">'+
      '<div class="sp-modal-body"><label class="sp-span">Nome da categoria<input name="name" required minlength="2" maxlength="80" placeholder="Ex.: Cabelo"></label></div>'+
      '<footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-category-modal>Cancelar</button>'+
      '<button class="btn primary" type="submit">Cadastrar categoria</button></footer></form></div></dialog>'+
    '<div class="segmented-control category-tabs">'+
      '<button type="button" data-category-type="service" class="'+(selectedType==="service"?"active":"")+'">Serviços</button>'+
      '<button type="button" data-category-type="product" class="'+(selectedType==="product"?"active":"")+'">Produtos</button></div>'+
    '<div class="list-toolbar"><span class="result-count">'+visible.length+' categorias de '+typeLabel(selectedType).toLowerCase()+'</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhuma categoria cadastrada.</div>')+'</div>';
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
  try {
    const categories=await listCatalogCategories({client:supabase,orgId});
    if(!categoryPageState.commit(host,request,state.organization?.id,categories))return;
    renderCategoryManager(host,categories);
  } catch(error) {
    if(!categoryPageState.isCurrent(host,request,state.organization?.id))return;
    reportError(error,{context:"Categorias > carregar"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar categorias. Verifique se a migration de categorias foi aplicada no ambiente.</div>';
    return;
  }
  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!documentListenerBound) {
    documentListenerBound=true;
    document.addEventListener("click",event=>{
    const dialog=document.querySelector("#category-create-modal");
    if(!dialog)return;
    if(event.target.closest('[data-action="open-category-modal"]')&&canManageCategories()) {
      const snapshot=categoryPageState.current(document.querySelector("#categories-manager"),state.organization?.id);
      if(snapshot&&!snapshot.pending)openCategoryModal();
    }
    else if(event.target.closest("[data-close-category-modal]")||event.target===dialog) {
      if(dialog.open)dialog.close();
    }
    });
  }

  host.addEventListener("click",async event=>{
    const snapshot=categoryPageState.current(host,state.organization?.id);
    if(!snapshot||snapshot.pending)return;
    const tab=event.target.closest("[data-category-type]");
    if(tab) {
      selectedType=tab.dataset.categoryType;
      renderCategoryManager(host,snapshot.rows);
      return;
    }
    const edit=event.target.closest("[data-edit-category]");
    if(edit) {
      if(!canManageCategories())return toast("Somente proprietário ou administrador pode editar categorias.");
      const row=snapshot.rows.find(category=>category.id===edit.dataset.editCategory);
      if(!row)return toast("Categoria não encontrada. Atualize a lista.");
      openCategoryModal(row);
      return;
    }
    const toggle=event.target.closest("[data-toggle-category]");
    if(!toggle)return;
    if(!canManageCategories())return toast("Somente proprietário ou administrador pode alterar categorias.");
    const row=snapshot.rows.find(category=>category.id===toggle.dataset.toggleCategory);
    if(!row||toggle.disabled)return;
    const nextActive=!row.active;
    if(!window.confirm(nextActive?"Reativar esta categoria?":"Inativar esta categoria? Itens existentes manterão sua classificação."))return;
    toggle.disabled=true;
    snapshot.pending=true;
    try {
      const changed=await setCatalogCategoryActive({
        client:supabase,orgId:snapshot.orgId,categoryId:row.id,active:nextActive
      });
      if(!categoryPageState.isCurrent(host,snapshot,state.organization?.id))return;
      if(!changed)throw new Error("A categoria não foi encontrada.");
      toast(nextActive?"Categoria reativada.":"Categoria inativada.");
      await loadCategoriesPage();
    } catch(error) {
      if(categoryPageState.isCurrent(host,snapshot,state.organization?.id))reportError(error,{context:"Categorias > alterar situação"});
    } finally {
      snapshot.pending=false;
      if(toggle.isConnected)toggle.disabled=false;
    }
  });

  host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#category-create-form"))return;
    event.preventDefault();
    if(!canManageCategories())return toast("Somente proprietário ou administrador pode salvar categorias.");
    const values=new FormData(form);
    const submit=form.querySelector('[type="submit"]');
    const snapshot=categoryPageState.current(host,state.organization?.id);
    const categoryId=String(values.get("category_id")||"").trim()||null;
    if(!snapshot||!submit||submit.disabled||snapshot.pending)return;
    const existing=categoryId?snapshot.rows.find(row=>row.id===categoryId):null;
    if(categoryId&&!existing)return toast("Categoria não encontrada. Atualize a lista.");
    const name=String(values.get("name")||"").trim();
    if(name.length<2||name.length>80) {
      toast("Informe um nome entre 2 e 80 caracteres.");
      return;
    }
    submit.disabled=true;
    snapshot.pending=true;
    try {
      await saveCatalogCategory({
        client:supabase,orgId:snapshot.orgId,
        categoryId,categoryType:existing?.category_type||selectedType,name
      });
      if(!categoryPageState.isCurrent(host,snapshot,state.organization?.id))return;
      host.querySelector("#category-create-modal")?.close();
      toast(values.get("category_id")?"Categoria atualizada.":"Categoria cadastrada.");
      await loadCategoriesPage();
    } catch(error) {
      if(categoryPageState.isCurrent(host,snapshot,state.organization?.id))reportError(error,{context:"Categorias > salvar"});
    } finally {
      snapshot.pending=false;
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
