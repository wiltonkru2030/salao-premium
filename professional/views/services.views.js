/** Apresentação do catálogo vinculado, com busca instantânea no padrão global. */
import {escapeHtml, formatMoney} from "../utils/formatters.js";

/** Renderiza registros autorizados, pesquisáveis por nome, categoria, duração ou preço. */
export function renderProfessionalServices(services) {
  const rows = services.map(service => {
    const search = [service.name, service.category, service.duration_minutes+" min", service.price, formatMoney(service.price)].filter(value=>value!=null).join(" ");
    return '<article class="detail sp-content-surface professional-service-record" data-professional-search-text="'+escapeHtml(search)+'"><div class="record-main"><strong>'+
      escapeHtml(service.name)+'</strong><p class="meta">'+escapeHtml(service.category||"Serviço")+' · '+
      escapeHtml(service.duration_minutes)+' min</p></div><b class="professional-service-price">'+escapeHtml(formatMoney(service.price))+'</b></article>';
  }).join("");
  return '<section data-professional-list aria-labelledby="professional-services-heading">'+
    '<div class="section-title"><h2 id="professional-services-heading">Meus serviços</h2></div>'+
    '<label class="sp-labeled-field">Buscar serviço<input type="search" data-professional-list-search placeholder="Nome, categoria ou valor"></label>'+
    '<p class="empty sp-content-surface sp-content-surface--empty" data-professional-search-empty hidden>Nenhum serviço encontrado.</p>'+
    (rows||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhum serviço ativo está vinculado ao seu perfil.</p>')+'</section>';
}
