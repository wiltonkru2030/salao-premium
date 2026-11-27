/**
 * SALÃO PREMIUM — views de autenticação do App Profissional.
 * Responsabilidade: produzir exclusivamente o markup das telas de login e troca de senha.
 * Integração: chamadas pelo controlador professional/app.js; não acessa DOM, rede ou sessão.
 */
import { renderPlatformAppearance } from "../../src/components/platform-appearance.js";
import { renderPlatformMark } from "../../src/components/platform-mark.js";
import { escapeHtml } from "../utils/formatters.js";

/**
 * Compõe as telas de acesso com as mesmas classes e a marca do painel.
 * Recebe campos definidos pela própria view e escapa mensagens dinâmicas.
 */
function renderProfessionalAuth({title, description, notice, form, footer = ""}) {
  return `<main class="auth-shell professional-auth">
    <section class="auth-panel">
      <div class="auth-brand">${renderPlatformMark()}<span><b>SALÃO PREMIUM</b><small>APP PROFISSIONAL</small></span></div>
      <div class="auth-heading"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
      ${notice ? '<div class="auth-notice error" role="status">' + escapeHtml(notice) + '</div>' : ''}
      ${form}
      ${footer}
    </section>
    <aside class="auth-aside"><div><h2>Seu salão.<br>Em perfeita sintonia.</h2><p>Acompanhe sua agenda, seus atendimentos e suas comissões.</p></div></aside>
  </main>`;
}

/**
 * Renderiza login por CPF ou e-mail, preservando os campos do controlador.
 * A preferência selecionada afeta somente a aparência neste aparelho.
 */
export function renderProfessionalLoginView(notice = "", appearance) {
  return renderProfessionalAuth({
    title: "Bem-vindo de volta",
    description: "Entre para acessar o App Profissional do seu salão.",
    notice,
    form: `<form id="professional-login" class="auth-form">
      <label>CPF ou e-mail<input name="login" autocomplete="username" placeholder="000.000.000-00 ou e-mail" required></label>
      <label>Senha<input name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required></label>
      <button class="auth-submit" type="submit">Entrar no sistema</button>
    </form>`,
    footer: '<details class="auth-legal"><summary>Esqueci minha senha</summary><p>Solicite uma senha temporária ao administrador do salão. Não enviamos senha por SMS ou e-mail.</p></details>' +
      renderPlatformAppearance(appearance)
  });
}

/** Renderiza o formulário obrigatório de troca da senha temporária. */
export function renderProfessionalPasswordChangeView(notice = "") {
  return renderProfessionalAuth({
    title: "Crie sua nova senha",
    description: "Altere a senha temporária para proteger seu acesso.",
    notice,
    form: `<form id="professional-password-change" class="auth-form">
      <label>Nova senha<input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
      <label>Confirmar senha<input name="confirm" type="password" minlength="10" autocomplete="new-password" required></label>
      <button class="auth-submit" type="submit">Salvar nova senha</button>
    </form>`
  });
}
