/**
 * Home da cliente.
 * Responsabilidade: exibir região atual, busca e resultados reais do diretório público.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 * Integração: app.js carrega os resultados por salonDirectoryService.js.
 */
import { escapeClientHtml } from "./view-utils.js";

/** Formata distância aproximada retornada pela busca geográfica. */
function distanceLabel(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) return "";
  return distance < 1 ? "A menos de 1 km" : "A " + distance.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " km";
}

/**
 * Renderiza busca pública sem criar salões ou avaliações fictícias.
 * @param {object} options Região, filtros, resultados e estado da consulta.
 * @returns {string} HTML da tela inicial.
 */
export function renderHomeView({
  locationLabel = "Ative a localização ou escolha sua cidade",
  salons = [],
  loading = false,
  error = "",
  query = ""
} = {}) {
  const results = salons.map(salon =>
    '<article class="salon-result-card"><div class="salon-result-main">' +
      '<span class="salon-avatar">' + escapeClientHtml((salon.display_name || "S").slice(0,1).toUpperCase()) + '</span>' +
      '<div><strong>' + escapeClientHtml(salon.display_name) + '</strong><span>' +
      escapeClientHtml(salon.branch_name || "Unidade") + '</span><small>' +
      escapeClientHtml([salon.neighborhood, salon.city, salon.state].filter(Boolean).join(" · ")) +
      '</small>' + (salon.distance_km !== null && salon.distance_km !== undefined ? '<small>' + escapeClientHtml(distanceLabel(salon.distance_km)) + '</small>' : '') +
      '</div></div><button class="client-button compact" data-action="open-salon" data-slug="' +
      escapeClientHtml(salon.slug) + '" data-branch-id="' + escapeClientHtml(salon.branch_id) +
      '" data-org-id="' + escapeClientHtml(salon.org_id) + '">Ver salão</button></article>'
  ).join("");
  let directory;
  if (loading) {
    directory = '<div class="empty-state"><span class="spinner"></span><p>Buscando salões publicados…</p></div>';
  } else if (error) {
    directory = '<div class="empty-state"><h3>Não foi possível buscar salões</h3><p>' +
      escapeClientHtml(error) + '</p><button class="client-button compact" data-action="retry-salon-search">Tentar novamente</button></div>';
  } else if (!salons.length) {
    directory = '<div class="empty-state"><span class="empty-icon">✦</span><h3>Nenhum salão publicado nesta busca</h3><p>Experimente outra cidade ou termo. Só aparecem estabelecimentos que ativaram sua vitrine pública.</p></div>';
  } else {
    directory = '<div class="salon-result-list">' + results + '</div>';
  }

  return '<section class="page-content">' +
    '<div class="page-heading"><span class="eyebrow">BEM-VINDA AO SALÃO PREMIUM</span><h1>Seu próximo cuidado começa aqui.</h1><p>Descubra estabelecimentos e acompanhe seus horários em um só lugar.</p></div>' +
    '<div class="location-card"><div><span class="eyebrow">SUA REGIÃO</span><strong>' + escapeClientHtml(locationLabel) + '</strong></div><button class="client-button compact" data-action="locate">Usar minha localização</button></div>' +
    '<form class="manual-location-form" data-location-form><input name="city" maxlength="80" placeholder="Cidade (ex.: Três Lagoas)" aria-label="Cidade" required><input name="neighborhood" maxlength="80" placeholder="Bairro (opcional)" aria-label="Bairro"><button class="client-button compact" type="submit">Usar esta região</button></form>' +
    '<form class="salon-search-form" data-salon-search><label for="salon-search-query">Buscar por nome do salão ou unidade</label><div><input id="salon-search-query" name="query" maxlength="120" value="' + escapeClientHtml(query) + '" placeholder="Ex.: Studio, Centro…"><button class="client-button" type="submit">Buscar</button></div></form>' +
    '<div class="section-heading"><h2>Salões disponíveis</h2><span class="muted">' + salons.length + ' unidade(s)</span></div>' +
    directory +
    '</section>';
}
