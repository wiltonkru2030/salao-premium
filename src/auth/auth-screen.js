/** Tela de autenticação administrativa. Responsabilidade: renderizar login/cadastro e mensagens de validação. */
import { esc } from '../utils.js';

/** Renderiza a tela de login ou cadastro com avisos de validação escapados para HTML. */
/** Renderiza login, cadastro e os dois passos de recuperação de senha. */
export function authScreen(mode = 'login', notice = '', noticeType = 'info') {
  const signup = mode === 'signup';
  const recoveryRequest = mode === 'recovery-request';
  const recoveryUpdate = mode === 'recovery-update';
  const formMode = signup ? 'signup' : recoveryRequest ? 'recovery-request' : recoveryUpdate ? 'recovery-update' : 'login';
  const title = signup ? 'Crie sua conta' : recoveryRequest ? 'Recuperar senha' : recoveryUpdate ? 'Definir nova senha' : 'Bem-vindo de volta';
  const description = signup ? 'Cadastre seu salão e comece a organizar sua gestão.' : recoveryRequest ? 'Informe seu e-mail para receber um link seguro de recuperação.' : recoveryUpdate ? 'Escolha uma nova senha para sua conta.' : 'Entre para acessar o painel do seu salão.';
  return `
  <main class="auth-shell">
    <section class="auth-panel">
      <div class="auth-brand">
        <img src="./brand/identidade-visual/logo/SAL%C3%83O%20PREMIUN_20261111_231325_0003.png" alt="SALÃO PREMIUM">
        <span><b>SALÃO PREMIUM</b><small>GESTÃO INTELIGENTE</small></span>
      </div>
      <div class="auth-heading">
        <span class="auth-eyebrow">ACESSO À PLATAFORMA</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${notice ? `<div class="auth-notice ${esc(noticeType)}" role="status">${esc(notice)}</div>` : ''}
      <form class="auth-form" data-auth-form="${formMode}">
        ${signup ? `<label>Seu nome<input name="full_name" autocomplete="name" placeholder="Nome completo" required></label><label>Nome do salão<input name="organization_name" autocomplete="organization" placeholder="Ex.: Salão Premium" required></label>` : ''}
        ${!recoveryUpdate ? `<label>E-mail<input name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></label>` : ''}
        ${!recoveryRequest && !recoveryUpdate ? `<label>Senha<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'Mínimo de 8 caracteres' : 'Sua senha'}" minlength="8" required></label>` : ''}
        ${recoveryUpdate ? `<label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirmar nova senha<input name="password_confirmation" type="password" autocomplete="new-password" minlength="8" required></label>` : ''}
        <button class="auth-submit" type="submit">${signup ? 'Criar minha conta' : recoveryRequest ? 'Enviar link de recuperação' : recoveryUpdate ? 'Salvar nova senha' : 'Entrar no sistema'}</button>
      </form>
      ${!signup && !recoveryRequest && !recoveryUpdate ? `<p class="auth-switch"><button type="button" data-auth-mode="recovery-request">Esqueci minha senha</button></p>` : ''}
      <p class="auth-switch"><button type="button" data-auth-mode="${signup || recoveryRequest || recoveryUpdate ? 'login' : 'signup'}">${signup || recoveryRequest || recoveryUpdate ? 'Voltar ao login' : 'Criar cadastro'}</button></p>
      <p class="auth-legal">Acesso protegido por autenticação e permissões do SALÃO PREMIUM.</p>
    </section>
    <aside class="auth-aside"><div><span>GESTÃO PROFISSIONAL</span><h2>Seu salão.<br>Em perfeita sintonia.</h2><p>Agenda, clientes, equipe e resultados em um só lugar.</p></div></aside>
  </main>`;
}
/**
 * Tela de seleção explícita do tenant quando o usuário participa de mais de uma organização.
 * @param {Array<{id:string,name:string,role:string}>} organizations Organizações acessíveis pela sessão.
 */
export function organizationSelectionScreen(organizations, notice = "") {
  return `
  <main class="auth-shell">
    <section class="auth-panel">
      <div class="auth-brand">
        <img src="./brand/identidade-visual/logo/SAL%C3%83O%20PREMIUN_20261111_231325_0003.png" alt="SALÃO PREMIUM">
        <span><b>SALÃO PREMIUM</b><small>GESTÃO INTELIGENTE</small></span>
      </div>
      <div class="auth-heading">
        <span class="auth-eyebrow">SELEÇÃO DE ORGANIZAÇÃO</span>
        <h1>Qual salão deseja acessar?</h1>
        <p>Sua conta tem acesso a mais de uma organização. Escolha o ambiente desta sessão.</p>
      </div>
      ${notice ? `<div class="auth-notice error" role="alert">${esc(notice)}</div>` : ""}
      <form class="auth-form" data-organization-form>
        <label>Organização
          <select name="org_id" required>
            <option value="">Selecione o salão</option>
            ${organizations.map(org => `<option value="${esc(org.id)}">${esc(org.name)} · ${esc(org.role)}</option>`).join("")}
          </select>
        </label>
        <button class="auth-submit" type="submit">Entrar nesta organização</button>
      </form>
      <p class="auth-legal">Os dados de cada organização permanecem isolados.</p>
    </section>
    <aside class="auth-aside"><div><span>GESTÃO PROFISSIONAL</span><h2>Seu salão.<br>Em perfeita sintonia.</h2><p>Agenda, clientes, equipe e resultados em um só lugar.</p></div></aside>
  </main>`;
}
