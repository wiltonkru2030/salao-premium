/** Apresentação do catálogo disponível para o profissional autenticado. */
import {escapeHtml, formatMoney} from "../utils/formatters.js";

/** Renderiza os serviços já filtrados pelo vínculo, com duração e preço. */
export function renderProfessionalServices(services) {
  const rows = services.map(service => '<article class="detail sp-content-surface professional-service-record"><div class="record-main"><strong>' +
    escapeHtml(service.name) + '</strong><p class="meta">' +
    escapeHtml(service.category || "Serviço") + ' · ' +
    escapeHtml(service.duration_minutes) + ' min</p></div><b class="professional-service-price">' +
    escapeHtml(formatMoney(service.price)) + '</b></article>').join("");
  return '<section aria-labelledby="professional-services-heading">' +
    '<div class="section-title"><h2 id="professional-services-heading">Meus serviços</h2></div>' +
    (rows || '<p class="empty sp-content-surface sp-content-surface--empty">Nenhum serviço ativo está vinculado ao seu perfil. Fale com o salão para revisar os vínculos.</p>') +
    '</section>';
}
