/**
 * Módulo: Produtos e estoque.
 * Responsabilidade: consultar, cadastrar, editar dados comerciais e inativar produtos.
 * Integração: Comandas, Vendas e movimentações de estoque.
 * Segurança: somente owner/admin altera; o serviço e RLS repetem a validação.
 * Regra: saldo existente só muda por movimentação de estoque, nunca pelo modal de edição.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, btn } from "../utils.js";
import { bindProductEvents } from "../modules/catalog/products.controller.js";
import { reportError } from "../utils/errors.js";
import { listProducts, saveProduct, setProductActive } from "../modules/catalog/products.service.js";
import { listCatalogCategories } from "../modules/catalog/categories.service.js";

import { renderProductsView } from "../modules/catalog/products.view.js";
import { createCatalogPageState } from "../modules/catalog/catalog-page-state.js";

const productPageState=createCatalogPageState();
const canManageProducts=()=>["owner","admin"].includes(state.membership?.role);

/** Renderiza a página de produtos e estoque. */
export function productsPage() {
  return head("Produtos e estoque","Cadastre produtos e acompanhe preço e quantidade disponível.",
    canManageProducts()?btn("＋ Novo produto","open-product-modal","primary"):"")+
    '<div id="products-manager"><div class="empty-state">Carregando produtos…</div></div>';
}

/**
 * Carrega produtos do tenant e conecta eventos do modal uma única vez.
 * @returns {Promise<void>} Atualiza a lista e estados de carregamento/erro.
 */
export async function loadProductsPage() {
  const host=document.querySelector("#products-manager");
  if(!host||!state.organization?.id)return;
  const orgId=state.organization.id;
  const request=productPageState.begin(host,orgId);
  host.textContent="Carregando produtos…";
  let products;
  let productCategories=null;
  try {
    products=await listProducts({client:supabase,orgId});
    try {
      productCategories=await listCatalogCategories({
        client:supabase,orgId,categoryType:"product",activeOnly:true
      });
    } catch(categoryError) {
      if(["PGRST202","PGRST205","42P01","42883"].includes(categoryError?.code))productCategories=null;
      else throw categoryError;
    }
    if(!productPageState.commit(host,request,state.organization?.id,products))return;
    host.innerHTML=renderProductsView(products,productCategories,canManageProducts());
  } catch(error) {
    if(!productPageState.isCurrent(host,request,state.organization?.id))return;
    reportError(error,{context:"Produtos > carregar lista"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar os produtos. Atualize a página e tente novamente.</div>';
    return;
  }


  bindProductEvents({
    host,client:supabase,productPageState,getOrgId:()=>state.organization?.id,
    canManageProducts,toast,reportError,saveProduct,setProductActive,loadProductsPage
  });
}
