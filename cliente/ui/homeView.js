/**
 * Home da cliente.
 * Responsabilidade: exibir região atual, descoberta e categorias sem inventar resultados de salões.
 */
import { escapeClientHtml } from "./view-utils.js";
export function renderHomeView({locationLabel = "Ative a localização ou escolha sua cidade"} = {}) {
  return '<section class="page-content">' +
    '<div class="page-heading"><span class="eyebrow">BEM-VINDA AO SALÃO PREMIUM</span><h1>Seu próximo cuidado começa aqui.</h1><p>Descubra estabelecimentos e acompanhe seus horários em um só lugar.</p></div>' +
    '<div class="location-card"><div><span class="eyebrow">SUA REGIÃO</span><strong>' + escapeClientHtml(locationLabel) + '</strong></div><button class="client-button compact" data-action="locate">Usar minha localização</button></div>' +
    '<form class="manual-location-form" data-location-form><input name="city" maxlength="80" placeholder="Cidade (ex.: Três Lagoas)" aria-label="Cidade" required><input name="neighborhood" maxlength="80" placeholder="Bairro (opcional)" aria-label="Bairro"><button class="client-button compact" type="submit">Usar esta região</button></form>' +
    '<div class="section-heading"><h2>Descubra salões</h2><span class="muted">Em preparação</span></div>' +
    '<div class="empty-state"><span class="empty-icon">✦</span><h3>Estamos preparando a vitrine</h3><p>A busca pública será liberada quando o diretório de salões e as regras de privacidade estiverem implantados.</p></div>' +
    '<div class="section-heading"><h2>Categorias</h2></div><div class="category-grid"><span>Cabelo</span><span>Barbearia</span><span>Unhas</span><span>Estética</span><span>Sobrancelha</span></div></section>';
}
