/**
 * Interface do catálogo de serviços: marcação sem eventos ou acesso ao banco.
 */
import { esc } from "../../utils.js";
/** Formata um preço para exibição em reais. */
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/**
 * Gera a listagem e o formulário, escapando dados externos.
 * @param {Array<object>} services Serviços cadastrados.
 * @param {Array<object>|null} serviceCategories Categorias disponíveis.
 * @param {boolean} canManage Permissão visual.
 * @returns {string} HTML da interface.
 */
export function renderServicesView(services,serviceCategories,canManage=false) {
  if(!Array.isArray(services))throw new TypeError("Lista de serviços inválida.");
  const cards=services.map(service=>{
    const actions=canManage
      ? '<button class="btn secondary" type="button" data-edit-service="'+esc(service.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-service="'+esc(service.id)+'" data-active="'+(service.active?"true":"false")+'">'+(service.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(service.name)+'</b>'+
      '<small>'+esc(service.category||"Sem categoria")+' · '+Number(service.duration_minutes)+' min</small></span>'+
      '<span class="record-trailing"><b>'+money(service.price)+'</b>'+
      '<small class="status-pill '+(service.active?"active":"inactive")+'">'+(service.active?"Ativo":"Inativo")+'</small>'+actions+
      '</span></article>';
  }).join("");

  return (
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
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhum serviço cadastrado.</div>')+'</div>');
}
