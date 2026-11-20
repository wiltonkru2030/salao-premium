/**
 * Tela: identityLinkRequestsView.js
 * Responsabilidade: exibir pedidos de associação de cadastro legado para consentimento.
 * Não consulta tabelas diretamente; recebe dados mínimos do serviço de identidade.
 * Nenhum identificador de cadastro operacional ou telefone completo é exibido.
 */
import { escapeClientHtml } from "./view-utils.js";

/**
 * Renderiza solicitações pendentes com dados mínimos e ação explícita de consentimento.
 * @param {{requests?:Array<object>,loading?:boolean}} options - Estado já carregado pelo serviço.
 * @returns {string} HTML seguro da tela de vínculos.
 */
export function renderIdentityLinkRequestsView({requests = [], loading = false} = {}) {
  if (loading) {
    return '<section class="page-content"><div class="page-heading"><span class="eyebrow">SEGURANÇA DA CONTA</span><h1>Vínculos com salões</h1></div><p role="status">Carregando solicitações…</p></section>';
  }
  const cards = requests.map(item => {
    const expiry = new Date(item.expiresAt).toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"});
    const phone = item.phoneSuffix ? "Telefone terminado em ••" + escapeClientHtml(item.phoneSuffix) : "Telefone não informado";
    return '<article class="profile-card identity-link-card"><div><strong>' + escapeClientHtml(item.salonName) + '</strong><span>Cadastro: ' + escapeClientHtml(item.customerName) + '</span><small>' + phone + '</small><small>Expira em ' + escapeClientHtml(expiry) + '</small></div><button type="button" class="client-button primary compact" data-action="confirm-identity-link" data-request-id="' + escapeClientHtml(item.requestId) + '">Confirmar vínculo</button></article>';
  }).join("");
  return '<section class="page-content"><div class="page-heading"><span class="eyebrow">SEGURANÇA DA CONTA</span><h1>Vínculos com salões</h1><p>Confira os dados antes de permitir que seu cadastro antigo seja associado à sua conta.</p></div>' +
    (cards || '<div class="empty-state"><strong>Nenhuma solicitação pendente</strong><p>Quando um salão solicitar a associação de um cadastro antigo, ela aparecerá aqui para sua confirmação.</p></div>') +
    '<p class="client-note">Confirmar um vínculo não libera acesso a dados de outros salões. Você poderá acessar somente os dados permitidos daquele estabelecimento.</p></section>';
}
