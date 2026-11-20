/**
 * SALÃO PREMIUM — views de autenticação do App Profissional.
 * Responsabilidade: produzir exclusivamente o markup das telas de login e troca de senha.
 * Integração: chamadas pelo controlador professional/app.js; não acessa DOM, rede ou sessão.
 */
import { escapeHtml } from "../utils/formatters.js";

/**
 * Monta a tela de login do profissional.
 * @param {string} notice Mensagem opcional de validação ou falha.
 * @returns {string} Markup da tela de autenticação.
 */
export function renderProfessionalLoginView(notice = "") {
  return '<main class="login"><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Bem-vindo(a)</h1><p>Profissionais entram com CPF e senha. Proprietários e usuários autorizados podem usar o e-mail.</p>' +
    (notice ? '<div class="notice">' + escapeHtml(notice) + '</div>' : '') +
    '<form id="professional-login"><label class="field">CPF ou e-mail<input name="login" autocomplete="username" placeholder="000.000.000-00 ou e-mail" required></label><label class="field">Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Entrar</button></form><p class="muted">A recuperação de senha é feita somente pelo administrador do salão.</p></main>';
}

/**
 * Monta a tela de troca obrigatória de senha temporária.
 * @param {string} notice Mensagem opcional de validação ou falha.
 * @returns {string} Markup do formulário de nova senha.
 */
export function renderProfessionalPasswordChangeView(notice = "") {
  return '<main class="login"><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Crie sua nova senha</h1><p>Altere a senha temporária para proteger seu acesso.</p>' +
    (notice ? '<div class="notice">' + escapeHtml(notice) + '</div>' : '') +
    '<form id="professional-password-change"><label class="field">Nova senha<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><label class="field">Confirmar senha<input name="confirm" type="password" minlength="10" autocomplete="new-password" required></label><button class="primary" type="submit">Salvar nova senha</button></form></main>';
}
