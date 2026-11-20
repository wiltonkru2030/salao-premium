/**
 * Controlador de categorias: eventos e modais, sem consultas diretas ao banco.
 */
/**
 * Abre modal de criação/edição da categoria.
 * @param {object|null} category Categoria existente ou null para novo cadastro.
 * @returns {void} Preenche os campos e exibe o modal.
 */
function openCategoryModal(category=null,selectedType="service") {
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


let documentListenerBound=false;
/**
 * Conecta eventos delegados ao contexto e aos serviços injetados.
 * @param {object} options Dependências da página.
 * @returns {void} Registra eventos.
 */
export function bindCategoryEvents({host,client,categoryPageState,getOrgId,getSelectedType,setSelectedType,renderCategoryManager,canManageCategories,toast,reportError,saveCatalogCategory,setCatalogCategoryActive,loadCategoriesPage}) {
  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!documentListenerBound) {
    documentListenerBound=true;
    document.addEventListener("click",event=>{
    const dialog=document.querySelector("#category-create-modal");
    if(!dialog)return;
    if(event.target.closest('[data-action="open-category-modal"]')&&canManageCategories()) {
      const snapshot=categoryPageState.current(document.querySelector("#categories-manager"),getOrgId());
      if(snapshot&&!snapshot.pending)openCategoryModal(null,getSelectedType());
    }
    else if(event.target.closest("[data-close-category-modal]")||event.target===dialog) {
      if(dialog.open)dialog.close();
    }
    });
  }

  host.addEventListener("click",async event=>{
    const snapshot=categoryPageState.current(host,getOrgId());
    if(!snapshot||snapshot.pending)return;
    const tab=event.target.closest("[data-category-type]");
    if(tab) {
      if(!["service","product"].includes(tab.dataset.categoryType))return;
      setSelectedType(tab.dataset.categoryType);
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
    if(!categoryPageState.isCurrent(host,snapshot,getOrgId()))return;
    toggle.disabled=true;
    snapshot.pending=true;
    try {
      const changed=await setCatalogCategoryActive({
        client,orgId:snapshot.orgId,categoryId:row.id,active:nextActive
      });
      if(!categoryPageState.isCurrent(host,snapshot,getOrgId()))return;
      if(!changed)throw new Error("A categoria não foi encontrada.");
      toast(nextActive?"Categoria reativada.":"Categoria inativada.");
      await loadCategoriesPage();
    } catch(error) {
      if(categoryPageState.isCurrent(host,snapshot,getOrgId()))reportError(error,{context:"Categorias > alterar situação"});
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
    const snapshot=categoryPageState.current(host,getOrgId());
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
        client,orgId:snapshot.orgId,
        categoryId,categoryType:existing?.category_type||getSelectedType(),name
      });
      if(!categoryPageState.isCurrent(host,snapshot,getOrgId()))return;
      host.querySelector("#category-create-modal")?.close();
      toast(values.get("category_id")?"Categoria atualizada.":"Categoria cadastrada.");
      await loadCategoriesPage();
    } catch(error) {
      if(categoryPageState.isCurrent(host,snapshot,getOrgId()))reportError(error,{context:"Categorias > salvar"});
    } finally {
      snapshot.pending=false;
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
