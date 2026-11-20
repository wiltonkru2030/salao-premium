/**
 * Tela de salões favoritos da cliente.
 * Responsabilidade: listar somente vitrines públicas associadas à identidade global.
 */
import { escapeClientHtml } from "./view-utils.js";

/** Renderiza estados de carregamento, erro, vazio e lista de favoritos. */
export function renderFavoritesView({items=[],loading=false,error=""}={}) {
  if(loading)return '<section class="page-content"><div class="empty-state"><span class="spinner"></span><p>Carregando favoritos…</p></div></section>';
  if(error)return '<section class="page-content"><button class="text-button" data-action="back-profile">‹ Voltar ao perfil</button><div class="empty-state"><h3>Favoritos indisponíveis</h3><p>'+escapeClientHtml(error)+'</p></div></section>';
  if(!items.length)return '<section class="page-content"><button class="text-button" data-action="back-profile">‹ Voltar ao perfil</button><div class="page-heading"><h1>Meus favoritos</h1><p>Salões que você salvou para encontrar novamente.</p></div><div class="empty-state"><h3>Nenhum favorito salvo</h3><p>Abra a vitrine de um salão e toque em Favoritar.</p></div></section>';
  return '<section class="page-content"><button class="text-button" data-action="back-profile">‹ Voltar ao perfil</button><div class="page-heading"><h1>Meus favoritos</h1><p>'+items.length+' unidade(s) publicada(s).</p></div><div class="salon-result-list">'+items.map(item=>
    '<article class="salon-result-card"><div class="salon-result-main"><span class="salon-avatar">✦</span><div><strong>'+escapeClientHtml(item.display_name)+'</strong><span>'+escapeClientHtml(item.branch_name||"Unidade")+'</span><small>'+escapeClientHtml([item.neighborhood,item.city,item.state].filter(Boolean).join(" · "))+'</small></div></div><div class="favorite-card-actions"><button class="client-button compact" data-action="open-favorite" data-slug="'+escapeClientHtml(item.slug)+'" data-branch-id="'+escapeClientHtml(item.branch_id)+'" data-org-id="'+escapeClientHtml(item.org_id)+'">Ver salão</button><button class="text-button" data-action="remove-favorite" data-org-id="'+escapeClientHtml(item.org_id)+'">Remover</button></div></article>'
  ).join("")+'</div></section>';
}
