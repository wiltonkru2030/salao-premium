/**
 * Tela de entrada da cliente.
 * Responsabilidade: apresentar os provedores de autenticação habilitados sem solicitar PIN inseguro.
 */
import { escapeClientHtml } from "./view-utils.js";
export function renderLoginView(notice = "") {
  return '<section class="client-panel login-panel">' +
    '<div class="client-brand"><span class="brand-mark">SP</span><div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>' +
    '<span class="eyebrow">SEU MOMENTO, DO SEU JEITO</span>' +
    '<h1 class="client-title">Encontre seu próximo momento de cuidado.</h1>' +
    '<p class="client-description">Uma única conta para descobrir salões, acompanhar seus horários e cuidar da sua rotina.</p>' +
    '<div class="client-alert" data-notice role="status" ' + (notice ? "" : "hidden") + '>' + escapeClientHtml(notice) + '</div>' +
    '<div class="client-actions"><button class="client-button primary" data-action="google">Continuar com Google</button><button class="client-button" data-action="passkey">Entrar com chave de acesso</button></div>' +
    '<p class="client-note">Sua conta é global. Seus agendamentos e dados de cada salão permanecem separados e protegidos.</p>' +
    '<div class="client-foot">SALÃO PREMIUM · Acesso simples e protegido</div></section>';
}
