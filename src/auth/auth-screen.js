/** Tela de autenticação administrativa. Responsabilidade: renderizar login/cadastro e mensagens de validação. */
import { esc } from '../utils.js';

export function authScreen(mode = 'login', notice = '', noticeType = 'info') {
  const signup = mode === 'signup';
  return `
  <main class="auth-shell">
    <section class="auth-panel">
      <div class="auth-brand">
        <img src="./brand/identidade-visual/logo/SAL%C3%83O%20PREMIUN_20261111_231325_0003.png" alt="SALÃO PREMIUM">
        <span><b>SALÃO PREMIUM</b><small>GESTÃO INTELIGENTE</small></span>
      </div>
      <div class="auth-heading">
        <span class="auth-eyebrow">ACESSO À PLATAFORMA</span>
        <h1>${signup ? 'Crie sua conta' : 'Bem-vindo de volta'}</h1>
        <p>${signup ? 'Cadastre seu salão e comece a organizar sua gestão.' : 'Entre para acessar o painel do seu salão.'}</p>
      </div>
      ${notice ? `<div class="auth-notice ${esc(noticeType)}" role="status">${esc(notice)}</div>` : ''}
      <form class="auth-form" data-auth-form="${signup ? 'signup' : 'login'}">
        ${signup ? `
          <label>Seu nome<input name="full_name" autocomplete="name" placeholder="Nome completo" required></label>
          <label>Nome do salão<input name="organization_name" autocomplete="organization" placeholder="Ex.: Salão Premium" required></label>
        ` : ''}
        <label>E-mail<input name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></label>
        <label>Senha<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'Mínimo de 8 caracteres' : 'Sua senha'}" minlength="8" required></label>
        <button class="auth-submit" type="submit">${signup ? 'Criar minha conta' : 'Entrar no sistema'}</button>
      </form>
      <p class="auth-switch">${signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button type="button" data-auth-mode="${signup ? 'login' : 'signup'}">${signup ? 'Fazer login' : 'Criar cadastro'}</button></p>
      <p class="auth-legal">Acesso protegido por autenticação e permissões do SALÃO PREMIUM.</p>
    </section>
    <aside class="auth-aside"><div><span>GESTÃO PROFISSIONAL</span><h2>Seu salão.<br>Em perfeita sintonia.</h2><p>Agenda, clientes, equipe e resultados em um só lugar.</p></div></aside>
  </main>`;
}
