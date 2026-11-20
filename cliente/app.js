/**
 * Entrada da Área da Cliente.
 * Compõe autenticação, navegação e serviços independentes.
 * Nenhuma tela consulta dados do salão sem passar pelos serviços e pelas permissões do backend.
 */
import { getCurrentSession, subscribeToAuthChanges, signInWithGoogle, signInWithPasskey, registerPasskey, signOut } from "./services/authService.js";
import { getCurrentPosition } from "./services/geoSalonService.js";
import { getLocalSettings, saveLocalSettings } from "./services/settingsService.js";
import { renderBottomNavigation } from "./ui/bottomNavigation.js";
import { getMyProfile } from "./services/customerProfileService.js";

const root = document.querySelector("#cliente-app");
let currentSession = null;
let activePage = "home";
let busy = false;
let locationLabel = "Ative a localização ou escolha sua cidade";
let profileState = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
  });
}
function setNotice(message, type) {
  const region = root.querySelector("[data-notice]");
  if (!region) return;
  region.textContent = message || "";
  region.className = "client-alert " + (type || "info");
  region.hidden = !message;
}
function renderLogin(notice) {
  root.innerHTML =
    '<section class="client-panel login-panel">' +
      '<div class="client-brand"><span class="brand-mark">SP</span><div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>' +
      '<span class="eyebrow">SEU MOMENTO, DO SEU JEITO</span>' +
      '<h1 class="client-title">Encontre seu próximo momento de cuidado.</h1>' +
      '<p class="client-description">Uma única conta para descobrir salões, acompanhar seus horários e cuidar da sua rotina.</p>' +
      '<div class="client-alert" data-notice role="status" ' + (notice ? "" : "hidden") + '>' + escapeHtml(notice) + '</div>' +
      '<div class="client-actions"><button class="client-button primary" data-action="google">Continuar com Google</button><button class="client-button" data-action="passkey">Entrar com chave de acesso</button></div>' +
      '<p class="client-note">Sua conta é global. Seus agendamentos e dados de cada salão permanecem separados e protegidos.</p>' +
      '<div class="client-foot">SALÃO PREMIUM · Acesso simples e protegido</div>' +
    '</section>';
}
function renderHome() {
  return '<section class="page-content">' +
    '<div class="page-heading"><span class="eyebrow">BEM-VINDA AO SALÃO PREMIUM</span><h1>Seu próximo cuidado começa aqui.</h1><p>Descubra estabelecimentos e acompanhe seus horários em um só lugar.</p></div>' +
    '<div class="location-card"><div><span class="eyebrow">SUA REGIÃO</span><strong data-location-label>' + escapeHtml(locationLabel) + '</strong></div><button class="client-button compact" data-action="locate">Usar minha localização</button></div>' +
    '<div class="section-heading"><h2>Descubra salões</h2><span class="muted">Em preparação</span></div>' +
    '<div class="empty-state"><span class="empty-icon">✦</span><h3>Estamos preparando a vitrine</h3><p>A busca pública será liberada quando o diretório de salões e as regras de privacidade estiverem implantados.</p></div>' +
    '<div class="section-heading"><h2>Categorias</h2></div><div class="category-grid"><span>Cabelo</span><span>Barbearia</span><span>Unhas</span><span>Estética</span><span>Sobrancelha</span></div>' +
    '</section>';
}
function renderAppointments() {
  return '<section class="page-content"><div class="page-heading"><span class="eyebrow">SUA ROTINA</span><h1>Agendamentos</h1><p>Seus próximos horários e seu histórico ficarão reunidos aqui.</p></div>' +
    '<div class="empty-state"><span class="empty-icon">▣</span><h3>Agendamentos em preparação</h3><p>Ainda não há conexão com o serviço de reservas. Nenhum horário será exibido como confirmado antes da validação no banco.</p></div></section>';
}
function renderProfile() {
  const name = profileState && profileState.fullName || currentSession.user.user_metadata && currentSession.user.user_metadata.full_name || "Seu perfil";
  const email = profileState && profileState.email || currentSession.user.email || "E-mail não informado";
  const theme = getLocalSettings().theme;
  return '<section class="page-content"><div class="page-heading"><span class="eyebrow">CONTA GLOBAL</span><h1>Meu perfil</h1><p>Uma identidade para acessar diferentes salões.</p></div>' +
    '<div class="profile-card"><div class="avatar-mark">' + escapeHtml(name.slice(0,1).toUpperCase()) + '</div><div><strong>' + escapeHtml(name) + '</strong><span>' + escapeHtml(email) + '</span></div></div>' +
    '<div class="settings-list"><button class="settings-row" data-action="register-passkey"><span><strong>Chaves de acesso</strong><small>Adicionar Passkey neste aparelho</small></span><span>›</span></button>' +
    '<button class="settings-row" data-action="theme"><span><strong>Aparência</strong><small>Tema: ' + escapeHtml(theme) + '</small></span><span>›</span></button>' +
    '<button class="settings-row" data-action="sign-out"><span><strong>Sair da conta</strong><small>Encerrar sua sessão neste aparelho</small></span><span>›</span></button></div>' +
    '<p class="client-note">O perfil global e os vínculos com salões serão ativados após a migration e os testes RLS.</p></section>';
}
function applyTheme() {
  const theme = getLocalSettings().theme;
  document.documentElement.dataset.theme = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
}
function renderApp() {
  const page = activePage === "appointments" ? renderAppointments() : activePage === "profile" ? renderProfile() : renderHome();
  root.innerHTML = '<div class="client-app-shell"><header class="app-header"><div class="client-brand compact-brand"><span class="brand-mark">SP</span><div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div><button class="icon-button" data-action="profile" aria-label="Abrir perfil">○</button></header><div class="client-alert" data-notice role="status" hidden></div><main>' + page + '</main><div data-bottom-nav></div></div>';
  root.querySelector("[data-bottom-nav]").append(renderBottomNavigation(activePage, function (pageId) {
    activePage = pageId;
    if (pageId === "profile") loadProfile().finally(renderApp);
    else renderApp();
  }));
  applyTheme();
}
async function loadProfile() {
  try { profileState = await getMyProfile(); }
  catch (error) {
    profileState = null;
    if (error && error.code !== "CUSTOMER_PROFILE_NOT_READY") console.warn("Falha ao consultar perfil global.", error.code || "PROFILE_ERROR");
  }
}
async function runAction(action, button) {
  if (busy) return;
  busy = true;
  if (button) button.disabled = true;
  try {
    if (action === "google") await signInWithGoogle();
    else if (action === "passkey") await signInWithPasskey();
    else if (action === "register-passkey") {
      await registerPasskey();
      renderApp();
      setNotice("Chave de acesso cadastrada com sucesso.", "success");
    } else if (action === "sign-out") {
      await signOut();
      currentSession = null;
      profileState = null;
      renderLogin();
    } else if (action === "locate") {
      const position = await getCurrentPosition();
      locationLabel = "Localização obtida (precisão aproximada: " + Math.round(position.accuracy) + " m)";
      renderApp();
      setNotice("Localização disponível neste aparelho. Ela ainda não foi enviada ao servidor.", "success");
    } else if (action === "theme") {
      const current = getLocalSettings().theme;
      saveLocalSettings({theme: current === "system" ? "light" : current === "light" ? "dark" : "system"});
      renderApp();
      setNotice("Aparência atualizada.", "success");
    } else if (action === "profile") {
      activePage = "profile";
      await loadProfile();
      renderApp();
    }
  } catch (error) {
    const message = error && error.message || "Não foi possível concluir esta ação. Tente novamente.";
    if (!currentSession) renderLogin(message);
    else { renderApp(); setNotice(message, "error"); }
  } finally {
    busy = false;
    const current = root.querySelector('[data-action="' + action + '"]');
    if (current) current.disabled = false;
  }
}
root.addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (button) runAction(button.dataset.action, button);
});
async function start() {
  try {
    currentSession = await getCurrentSession();
    if (currentSession) { await loadProfile(); renderApp(); }
    else renderLogin();
    subscribeToAuthChanges(async function (session) {
      currentSession = session;
      if (session) { await loadProfile(); renderApp(); }
      else { profileState = null; renderLogin(); }
    });
  } catch {
    renderLogin("Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.");
  }
}
start();
