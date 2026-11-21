/**
 * Controlador de produtos: modais, eventos, validação de entradas e feedback.
 * Recebe serviços por injeção; não contém consultas ao banco nem marcação HTML.
 */
import { parseBRL, applyInputMask } from "../../utils/input-masks.js";
import { state } from "../../state.js";
/**
 * Abre o modal de cadastro/edição e preenche dados do produto.
 * @param {object|null} product Produto existente ou null para novo.
 * @returns {void} Exibe o modal e aplica máscaras monetárias.
 */
function openProductModal(product=null) {
  const dialog=document.querySelector("#product-create-modal");
  const form=dialog?.querySelector("#product-create-form");
  if(!dialog||!form)return;
  form.reset();
  form.elements.product_id.value=product?.id||"";
  form.elements.name.value=product?.name||"";
  form.elements.sku.value=product?.sku||"";
  const categoryField=form.elements.category;
  // Remove a opção temporária de uma edição anterior antes de abrir outro cadastro.
  if(categoryField.tagName==="SELECT")categoryField.querySelectorAll("[data-legacy-category]").forEach(option=>option.remove());
  if(categoryField.tagName==="SELECT"&&product?.category&&
     ![...categoryField.options].some(option=>option.value===product.category)) {
    const option=document.createElement("option");
    option.dataset.legacyCategory="true";
    option.value=product.category;
    option.textContent=product.category+" (inativa)";
    categoryField.add(option);
  }
  categoryField.value=product?.category||"";
  form.elements.cost_price.value=Number(product?.cost_price||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  form.elements.sale_price.value=Number(product?.sale_price||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  form.elements.stock_quantity.value=Number(product?.stock_quantity||0);
  form.elements.stock_quantity.readOnly=Boolean(product);
  form.elements.stock_quantity.title=product?"Saldo só pode ser alterado por movimentação de estoque.":"Saldo inicial do produto.";
  form.elements.min_stock.value=Number(product?.min_stock||0);
  applyInputMask(form.elements.cost_price);
  applyInputMask(form.elements.sale_price);
  const title=dialog.querySelector("#product-modal-title");
  const submit=form.querySelector('[type="submit"]');
  if(title)title.textContent=product?"Editar produto":"Novo produto";
  if(submit)submit.textContent=product?"Salvar alterações":"Cadastrar produto";
  if(!dialog.open)dialog.showModal();
}


let modalListenerInstalled=false;
/**
 * Conecta eventos da página uma vez por montagem.
 * @param {object} options Contexto, estado, serviços e notificações.
 * @returns {void} Registra os eventos de gerenciamento.
 */
export function bindProductEvents({host,client,productPageState,getOrgId,canManageProducts,toast,reportError,saveProduct,setProductActive,loadProductsPage}) {
  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!modalListenerInstalled) {
    modalListenerInstalled=true;
    document.addEventListener("click",event=>{
      const dialog=document.querySelector("#product-create-modal");
      if(!dialog)return;
      if(event.target.closest('[data-action="open-product-modal"]')&&canManageProducts()) {
        const snapshot=productPageState.current(document.querySelector("#products-manager"),getOrgId());
        if(snapshot&&!snapshot.pending)openProductModal();
      }
      else if(event.target.closest("[data-close-product-modal]")||event.target===dialog) {
        if(dialog.open)dialog.close();
      }
    });
  }

  host.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit-product]");
    if(edit) {
      if(!canManageProducts())return toast("Somente proprietário ou administrador pode editar produtos.");
      const snapshot=productPageState.current(host,getOrgId());
      if(!snapshot||snapshot.pending)return;
      const row=snapshot?.rows.find(item=>item.id===edit.dataset.editProduct);
      if(!row)return toast("Registro não encontrado. Atualize a lista.");
      openProductModal(row);
      return;
    }
    const toggle=event.target.closest("[data-toggle-product]");
    if(!toggle)return;
    if(!canManageProducts())return toast("Somente proprietário ou administrador pode alterar produtos.");
    const snapshot=productPageState.current(host,getOrgId());
    const row=snapshot?.rows.find(item=>item.id===toggle.dataset.toggleProduct);
    if(!row||toggle.disabled||snapshot.pending)return;
    const nextActive=!row.active;
    if(!window.confirm(nextActive?"Reativar este produto?":"Inativar este produto? O histórico será preservado."))return;
    if(!productPageState.isCurrent(host,snapshot,getOrgId()))return;
    toggle.disabled=true;
    snapshot.pending=true;
    try {
      await setProductActive({client,orgId:snapshot.orgId,branchId:state.branch?.id||null,productId:row.id,active:nextActive});
      if(!productPageState.isCurrent(host,snapshot,getOrgId()))return;
      toast(nextActive?"Produto reativado.":"Produto inativado.");
      await loadProductsPage();
    } catch(error) {
      if(productPageState.isCurrent(host,snapshot,getOrgId()))reportError(error,{context:"Produtos > alterar situação"});
    } finally {
      snapshot.pending=false;
      if(toggle.isConnected)toggle.disabled=false;
    }
  });

  host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#product-create-form"))return;
    event.preventDefault();
    if(!canManageProducts())return toast("Somente proprietário ou administrador pode cadastrar produtos.");
    const values=new FormData(form);
    const submit=form.querySelector('[type="submit"]');
    const snapshot=productPageState.current(host,getOrgId());
    const productId=String(values.get("product_id")||"").trim()||null;
    if(!snapshot||!submit||submit.disabled||snapshot.pending)return;
    if(productId&&!snapshot.rows.some(row=>row.id===productId))return toast("Registro não encontrado. Atualize a lista.");
    const name=String(values.get("name")||"").trim();
    const cost=parseBRL(values.get("cost_price"));
    const price=parseBRL(values.get("sale_price"));
    const stock=Number(values.get("stock_quantity")||0);
    const minStock=Number(values.get("min_stock")||0);
    if(!name||![cost,price,stock,minStock].every(Number.isFinite)||
       [cost,price,stock,minStock].some(value=>value<0)) {
      toast("Confira os dados e os valores do produto.");
      return;
    }
    submit.disabled=true;
    snapshot.pending=true;
    try {
      await saveProduct({
        client,orgId:snapshot.orgId,
        productId,branchId:state.branch?.id||null,
        name,sku:values.get("sku"),category:values.get("category"),
        costPrice:cost,salePrice:price,stockQuantity:stock,minStock
      });
      if(!productPageState.isCurrent(host,snapshot,getOrgId()))return;
      host.querySelector("#product-create-modal")?.close();
      toast(values.get("product_id")?"Produto atualizado.":"Produto cadastrado.");
      await loadProductsPage();
    } catch(error) {
      if(productPageState.isCurrent(host,snapshot,getOrgId()))reportError(error,{context:"Produtos > salvar cadastro"});
    } finally {
      snapshot.pending=false;
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
