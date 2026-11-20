/**
 * Perfil global da cliente.
 * Responsabilidade: apresentar e editar dados pessoais da identidade autenticada.
 * Ecossistema: Área da Cliente do SALÃO PREMIUM.
 * Integração: app.js envia o formulário para customerProfileService.js.
 */
import { escapeClientHtml } from "./view-utils.js";
import { formatCustomerPhoneDisplay } from "../customer-profile-utils.js";

/**
 * Renderiza os dados pessoais e ações de conta sem tratar contato como credencial.
 * @param {object} options Perfil, sessão autenticada e tema.
 * @returns {string} HTML seguro da tela de perfil.
 */
export function renderCustomerProfileView({profile = null, session, theme = "system"} = {}) {
  const metadata = session?.user?.user_metadata || {};
  const name = profile?.fullName || metadata.full_name || metadata.name || "";
  const email = profile?.email || session?.user?.email || "E-mail não informado";
  const phone = formatCustomerPhoneDisplay(profile?.phone);
  return '<section class="page-content"><div class="page-heading"><span class="eyebrow">CONTA GLOBAL</span><h1>Meu perfil</h1><p>Uma identidade para acessar diferentes salões.</p></div>' +
    '<div class="profile-card"><div class="avatar-mark">' + escapeClientHtml(name.slice(0,1).toUpperCase() || "C") + '</div><div><strong>' + escapeClientHtml(name || "Seu perfil") + '</strong><span>' + escapeClientHtml(email) + '</span></div></div>' +
    '<form class="detail-card profile-form" data-profile-form novalidate>' +
      '<label class="field-label" for="customer-profile-name">Nome completo</label><input id="customer-profile-name" name="fullName" maxlength="120" autocomplete="name" required value="' + escapeClientHtml(name) + '">' +
      '<label class="field-label" for="customer-profile-phone">Celular com DDD</label><input id="customer-profile-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="16" placeholder="(67) 99999-9999" value="' + escapeClientHtml(phone) + '">' +
      '<p class="client-note">O e-mail é o contato da conta. O telefone informado não é considerado verificado até passar por confirmação própria.</p>' +
      '<button class="client-button" type="submit" data-action="save-profile">Salvar alterações</button>' +
    '</form>' +
    '<div class="settings-list"><button class="settings-row" data-action="identity-links"><span><strong>Vínculos com salões</strong><small>Revisar solicitações de associação</small></span><span>›</span></button><button class="settings-row" data-action="register-passkey"><span><strong>Chaves de acesso</strong><small>Adicionar Passkey neste aparelho</small></span><span>›</span></button>' +
    '<button class="settings-row" data-action="theme"><span><strong>Aparência</strong><small>Tema: ' + escapeClientHtml(theme) + '</small></span><span>›</span></button>' +
    '<button class="settings-row" data-action="sign-out"><span><strong>Sair da conta</strong><small>Encerrar sua sessão neste aparelho</small></span><span>›</span></button></div></section>';
}
