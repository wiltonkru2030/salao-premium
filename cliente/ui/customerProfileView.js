/**
 * Perfil global da cliente.
 * Responsabilidade: apresentar dados da sessão e ações já conectadas aos serviços.
 */
import { escapeClientHtml } from "./view-utils.js";
export function renderCustomerProfileView({profile = null, session, theme = "system"} = {}) {
  const metadata = session?.user?.user_metadata || {};
  const name = profile?.fullName || metadata.full_name || metadata.name || "Seu perfil";
  const email = profile?.email || session?.user?.email || "E-mail não informado";
  return '<section class="page-content"><div class="page-heading"><span class="eyebrow">CONTA GLOBAL</span><h1>Meu perfil</h1><p>Uma identidade para acessar diferentes salões.</p></div>' +
    '<div class="profile-card"><div class="avatar-mark">' + escapeClientHtml(name.slice(0,1).toUpperCase()) + '</div><div><strong>' + escapeClientHtml(name) + '</strong><span>' + escapeClientHtml(email) + '</span></div></div>' +
    '<div class="settings-list"><button class="settings-row" data-action="register-passkey"><span><strong>Chaves de acesso</strong><small>Adicionar Passkey neste aparelho</small></span><span>›</span></button>' +
    '<button class="settings-row" data-action="theme"><span><strong>Aparência</strong><small>Tema: ' + escapeClientHtml(theme) + '</small></span><span>›</span></button>' +
    '<button class="settings-row" data-action="sign-out"><span><strong>Sair da conta</strong><small>Encerrar sua sessão neste aparelho</small></span><span>›</span></button></div>' +
    '<p class="client-note">O perfil global e os vínculos com salões serão ativados após a migration e os testes RLS.</p></section>';
}
