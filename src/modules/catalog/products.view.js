/**
 * Interface de produtos e estoque.
 * Responsabilidade: gerar marcação segura, sem consultas ou eventos.
 */
import { esc } from "../../utils.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/**
 * Renderiza produtos, categorias e ações conforme permissão visual.
 * @param {Array<object>} products Produtos do estabelecimento.
 * @param {Array<object>|null} productCategories Categorias disponíveis.
 * @param {boolean} canManage Permissão de gerenciamento.
 * @returns {string} Marcação da listagem e modal.
 */
export function renderProductsView(products,productCategories,canManage=false) {
  if(!Array.isArray(products))throw new TypeError("Lista de produtos inválida.");
  const cards=products.map(product=>{
    const actions=canManage
      ? '<button class="btn secondary" type="button" data-edit-product="'+esc(product.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-product="'+esc(product.id)+'" data-active="'+(product.active?"true":"false")+'">'+(product.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(product.name)+'</b>'+
      '<small>'+esc(product.sku||"Sem SKU")+' · '+esc(product.category||"Sem categoria")+'</small>'+
      '<small>Estoque: '+Number(product.stock_quantity)+' · Mínimo: '+Number(product.min_stock)+'</small></span>'+
      '<span class="record-trailing"><b>'+money(product.sale_price)+'</b>'+
      '<small class="status-pill '+(product.active?"active":"inactive")+'">'+(product.active?"Ativo":"Inativo")+'</small>'+actions+
      '</span></article>';
  }).join("");

  return (
    '<dialog class="sp-modal" id="product-create-modal" aria-labelledby="product-modal-title">'+
      '<div class="sp-modal-shell"><header class="sp-modal-head"><div><h2 id="product-modal-title">Novo produto</h2><p>Defina dados comerciais e estoque inicial.</p></div>'+
      '<button class="sp-modal-close" type="button" data-close-product-modal aria-label="Fechar">×</button></header>'+
      '<form id="product-create-form"><input type="hidden" name="product_id"><div class="sp-modal-body">'+
      '<label class="sp-span">Nome do produto<input name="name" required maxlength="120" placeholder="Nome do produto"></label>'+
      '<label>SKU / Código<input name="sku" maxlength="64" placeholder="Código interno"></label>'+
      (Array.isArray(productCategories)
        ? '<label>Categoria<select name="category"><option value="">Sem categoria</option>'+productCategories.map(category=>'<option value="'+esc(category.name)+'">'+esc(category.name)+'</option>').join("")+'</select></label>'
        : '<label>Categoria<input name="category" maxlength="80" placeholder="Categoria (opcional)"></label>')+
      '<label>Custo (R$)<input name="cost_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>'+
      '<label>Preço de venda (R$)<input name="sale_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>'+
      '<label>Estoque inicial / atual<input name="stock_quantity" type="number" min="0" step="0.001" value="0"></label>'+
      '<label>Estoque mínimo<input name="min_stock" type="number" min="0" step="0.001" value="0"></label>'+
      '<p class="sp-span muted">Ao editar um produto, o saldo atual fica bloqueado. Ajustes de estoque devem ser lançados em Movimentações para preservar o histórico.</p>'+
      '</div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-product-modal>Cancelar</button>'+
      '<button class="btn primary" type="submit">Cadastrar produto</button></footer></form></div></dialog>'+
    '<div class="list-toolbar"><span class="result-count">'+products.length+' produtos</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhum produto cadastrado.</div>')+'</div>');
}
