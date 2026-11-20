/**
 * Interface das categorias: marcação segura sem acesso ao banco.
 */
import {esc} from "../../utils.js";
/** Retorna o nome visual do catálogo. */
const typeLabel=type=>type==="service"?"Serviços":"Produtos";
/**
 * Renderiza categorias do tipo selecionado.
 * @param {Array<object>} categories Registros da organização.
 * @param {string} selectedType Tipo de catálogo.
 * @param {boolean} canManage Permissão visual.
 * @returns {string} Marcação da interface.
 */
export function renderCategoriesView(categories,selectedType,canManage=false) {
  if(!Array.isArray(categories))throw new TypeError("Lista de categorias inválida.");
  const visible=categories.filter(category=>category.category_type===selectedType);
  const cards=visible.map(category=>{
    const actions=canManage
      ? '<button class="btn secondary" type="button" data-edit-category="'+esc(category.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-category="'+esc(category.id)+'" data-active="'+(category.active?"true":"false")+'">'+(category.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(category.name)+'</b>'+
      '<small class="status-pill '+(category.active?"active":"inactive")+'">'+(category.active?"Ativa":"Inativa")+'</small></span>'+
      '<span class="record-trailing">'+actions+'</span></article>';
  }).join("");
  return (
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
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhuma categoria cadastrada.</div>')+'</div>');
}


