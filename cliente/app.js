/**
 * Compositor principal da Área da Cliente.
 * Responsabilidade: controlar sessão, navegação, ações e estados globais simples.
 * Cada tela, serviço, componente e estilo fica em arquivo próprio.
 */
import { getCurrentSession, subscribeToAuthChanges, signInWithGoogle, signInWithPasskey, registerPasskey, signOut } from "./services/authService.js";
import { supabase } from "../src/supabase/client.js";
import { getCurrentPosition } from "./services/geoSalonService.js";
import { getLocalSettings, saveLocalSettings } from "./services/settingsService.js";
import { renderBottomNavigation } from "./ui/bottomNavigation.js";
import { renderLoginView } from "./ui/loginView.js";
import { renderHomeView } from "./ui/homeView.js";
import { renderAppointmentsView } from "./ui/appointmentsView.js";
import { fetchMyCustomerAppointments } from "./services/appointmentsService.js";
import { renderCustomerProfileView } from "./ui/customerProfileView.js";
import { ensureMyProfile, updateMyProfile } from "./services/customerProfileService.js";
import { formatCustomerPhoneInput } from "./customer-profile-utils.js";
import { listMyPendingIdentityLinks, confirmMyIdentityLink } from "./services/customerIdentityLinkService.js";
import { renderIdentityLinkRequestsView } from "./ui/identityLinkRequestsView.js";

const root = document.querySelector("#cliente-app");
let currentSession = null;
let activePage = "home";
let busy = false;
let locationLabel = "Ative a localização ou escolha sua cidade";
let profileState = null;
let identityLinkRequests = [];
let appointmentsState = { items: [], loading: false, error: "" };

/** Exibe aviso de operação na região acessível por leitor de tela. */
function setNotice(message, type = "info") {
  const region = root.querySelector("[data-notice]");
  if (!region) return;
  region.textContent = message || "";
  region.className = "client-alert " + type;
  region.hidden = !message;
}

/** Renderiza a tela de entrada sem duplicar lógica de autenticação. */
function renderLogin(notice = "") {
  root.innerHTML = renderLoginView(notice);
}

/** Aplica tema escolhido pela cliente; modo automático respeita o sistema operacional. */
function applyTheme() {
  const theme = getLocalSettings().theme;
  document.documentElement.dataset.theme = theme === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
}

/** Monta a página ativa e a navegação inferior sem recarregar o documento. */
function renderApp() {
  let page;
  if (activePage === "appointments") page = renderAppointmentsView({ appointments: appointmentsState.items, loading: appointmentsState.loading, error: appointmentsState.error });
  else if (activePage === "identity-links") page = renderIdentityLinkRequestsView({requests: identityLinkRequests});
  else if (activePage === "profile") {
    page = renderCustomerProfileView({profile: profileState, session: currentSession, theme: getLocalSettings().theme});
  } else page = renderHomeView({locationLabel});

  root.innerHTML =
    '<div class="client-app-shell">' +
      '<header class="app-header"><div class="client-brand compact-brand"><span class="brand-mark">SP</span><div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>' +
      '<button class="icon-button" data-action="profile" aria-label="Abrir perfil">○</button></header>' +
      '<div class="client-alert" data-notice role="status" hidden></div>' +
      '<main>' + page + '</main><div data-bottom-nav></div>' +
    '</div>';

  const navigation = renderBottomNavigation(activePage, async pageId => {
    activePage = pageId;
    if (pageId === "profile") await loadProfile();
    if (pageId === "appointments") await loadAppointments();
    renderApp();
  });
  root.querySelector("[data-bottom-nav]").append(navigation);
  applyTheme();
}

/** Prepara o perfil global idempotentemente; RLS restringe a operação à sessão atual. */
async function loadProfile() {
  try {
    profileState = await ensureMyProfile();
  } catch (error) {
    profileState = null;
    if (error?.code !== "CUSTOMER_PROFILE_NOT_READY") {
      console.warn("Falha ao preparar perfil global.", error?.code || "PROFILE_ERROR");
    }
  }
}

/** Carrega o histórico vinculado à identidade atual e mantém estados de carregamento/erro. */
async function loadAppointments() {
  appointmentsState = { ...appointmentsState, loading: true, error: "" };
  if (activePage === "appointments") renderApp();
  try {
    appointmentsState.items = await fetchMyCustomerAppointments({ client: supabase });
  } catch (error) {
    appointmentsState.error = error?.message || "Não foi possível carregar seus agendamentos.";
  } finally {
    appointmentsState.loading = false;
    if (activePage === "appointments") renderApp();
  }
}

/** Executa ações da interface com bloqueio contra cliques repetidos e mensagens seguras. */
async function runAction(action, button = null) {
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
      identityLinkRequests = [];
      renderLogin();
    } else if (action === "locate") {
      const position = await getCurrentPosition();
      locationLabel = "Localização obtida (precisão aproximada: " + Math.round(position.accuracy) + " m)";
      renderApp();
      setNotice("Localização disponível neste aparelho. Ela ainda não foi enviada ao servidor.", "success");
    } else if (action === "save-location") {
      const form = root.querySelector("[data-location-form]");
      const city = form?.elements.city.value.trim();
      const neighborhood = form?.elements.neighborhood.value.trim();
      if (!city || city.length < 2) throw new Error("Informe uma cidade válida.");
      saveLocalSettings({defaultCity: city, defaultNeighborhood: neighborhood || null});
      locationLabel = neighborhood ? city + " · " + neighborhood : city;
      renderApp();
      setNotice("Região padrão salva neste aparelho.", "success");
    } else if (action === "save-profile") {
      const form = root.querySelector("[data-profile-form]");
      const fullName = form?.elements.fullName.value || "";
      const phone = form?.elements.phone.value || "";
      profileState = await updateMyProfile({ fullName, phone, email: profileState?.email || currentSession?.user?.email || null });
      renderApp();
      setNotice("Seus dados foram atualizados.", "success");
    } else if (action === "reload-appointments") {
      await loadAppointments();
    } else if (action === "theme") {
      const current = getLocalSettings().theme;
      const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
      saveLocalSettings({theme: next});
      renderApp();
      setNotice("Aparência atualizada.", "success");
    } else if (action === "profile") {
      activePage = "profile";
      await loadProfile();
      renderApp();
    } else if (action === "identity-links") {
      activePage = "identity-links";
      identityLinkRequests = await listMyPendingIdentityLinks();
      renderApp();
    } else if (action === "confirm-identity-link") {
      const requestId = button?.dataset.requestId;
      if (!requestId) throw new Error("Selecione uma solicitação válida para confirmar.");
      await confirmMyIdentityLink(requestId);
      identityLinkRequests = await listMyPendingIdentityLinks();
      renderApp();
      setNotice("Vínculo confirmado. O acesso continua limitado aos dados deste salão.", "success");
    }
  } catch (error) {
    const message = error?.message || "Não foi possível concluir esta ação. Tente novamente.";
    if (!currentSession) renderLogin(message);
    else {
      renderApp();
      setNotice(message, "error");
    }
  } finally {
    busy = false;
    const current = root.querySelector('[data-action="' + action + '"]');
    if (current) current.disabled = false;
  }
}

/** Aplica máscara brasileira ao telefone sem alterar o valor limpo salvo no banco. */
root.addEventListener("input", event => {
  if (event.target.matches("#customer-profile-phone")) {
    const start = event.target.selectionStart;
    const previousLength = event.target.value.length;
    event.target.value = formatCustomerPhoneInput(event.target.value);
    const nextPosition = Math.max(0, (start ?? event.target.value.length) + event.target.value.length - previousLength);
    event.target.setSelectionRange(nextPosition, nextPosition);
  }
});

/** Intercepta envio do fallback de cidade e encaminha o evento ao serviço de preferências. */
root.addEventListener("submit", event => {
  const locationForm = event.target.closest("[data-location-form]");
  const profileForm = event.target.closest("[data-profile-form]");
  if (!locationForm && !profileForm) return;
  event.preventDefault();
  if (profileForm) runAction("save-profile", profileForm.querySelector('button[type="submit"]'));
  else runAction("save-location", locationForm.querySelector('button[type="submit"]'));
});

/** Centraliza os cliques das telas sem registrar listeners a cada renderização. */
root.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (button) runAction(button.dataset.action, button);
});

/** Recupera sessão persistente e acompanha login/logout sem recarregar a página. */
async function start() {
  try {
    currentSession = await getCurrentSession();
    if (currentSession) {
      await loadProfile();
      renderApp();
    } else renderLogin();
    subscribeToAuthChanges(async session => {
      currentSession = session;
      if (session) {
        await loadProfile();
        renderApp();
      } else {
        profileState = null;
        identityLinkRequests = [];
        renderLogin();
      }
    });
  } catch {
    renderLogin("Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.");
  }
}

start();
