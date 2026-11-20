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
import { renderSalonDetailView } from "./ui/salonDetailView.js";
import { searchPublicSalons, getPublicSalonCatalog } from "./services/salonDirectoryService.js";
import { getCustomerAvailableSlots, createAppointmentHold, confirmAppointmentHold, cancelAppointmentHold } from "./services/appointmentHoldService.js";
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
let directoryState = { items: [], loading: false, error: "", query: "" };
let locationCoordinates = null;
let salonDetailState = { salon: null, catalog: [], loading: false, error: "" };
let slotsState = { serviceId: null, items: [], loading: false, error: "", date: "" };
let holdState = null;

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
  } else if (activePage === "salon-detail") page = renderSalonDetailView({ ...salonDetailState, slots: slotsState, hold: holdState });
  else page = renderHomeView({ locationLabel, salons: directoryState.items, loading: directoryState.loading, error: directoryState.error, query: directoryState.query });

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
    if (pageId === "home") await loadPublicSalons();
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

/** Consulta somente salões e unidades que ativaram a publicação pública. */
async function loadPublicSalons() {
  directoryState = { ...directoryState, loading: true, error: "" };
  if (activePage === "home") renderApp();
  try {
    const settings = getLocalSettings();
    directoryState.items = await searchPublicSalons({
      client: supabase, query: directoryState.query,
      city: locationCoordinates ? null : settings.defaultCity || null,
      latitude: locationCoordinates?.latitude ?? null,
      longitude: locationCoordinates?.longitude ?? null,
      limit: 30
    });
  } catch (error) {
    directoryState.items = [];
    directoryState.error = error?.message || "Não foi possível buscar salões publicados.";
  } finally {
    directoryState.loading = false;
    if (activePage === "home") renderApp();
  }
}

/** Carrega o catálogo público da unidade selecionada sem consultar tabelas operacionais diretamente. */
async function loadSalonCatalog(salon) {
  if (holdState && (holdState.orgId !== salon.org_id || holdState.branchId !== salon.branch_id)) {
    const previousHold = holdState;
    holdState = null;
    try { await cancelAppointmentHold(previousHold.holdId); }
    catch { console.warn("Não foi possível cancelar a reserva anterior automaticamente."); }
  }
  salonDetailState = { salon, catalog: [], loading: true, error: "" };
  slotsState = { serviceId: null, items: [], loading: false, error: "", date: "" };
  activePage = "salon-detail";
  renderApp();
  try {
    salonDetailState.catalog = await getPublicSalonCatalog({ client: supabase, slug: salon.slug, branchId: salon.branch_id });
  } catch (error) {
    salonDetailState.error = error?.message || "Não foi possível carregar o catálogo deste salão.";
  } finally {
    salonDetailState.loading = false;
    renderApp();
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
      if (holdState?.holdId) { try { await cancelAppointmentHold(holdState.holdId); } catch { /* O HOLD possui expiração automática no backend. */ } }
      await signOut();
      currentSession = null;
      profileState = null;
      identityLinkRequests = [];
      renderLogin();
    } else if (action === "locate") {
      const position = await getCurrentPosition();
      locationCoordinates = { latitude: position.latitude, longitude: position.longitude };
      locationLabel = "Localização obtida (precisão aproximada: " + Math.round(position.accuracy) + " m)";
      await loadPublicSalons();
      renderApp();
      setNotice("Busca próxima atualizada. A localização foi usada somente nesta consulta.", "success");
    } else if (action === "save-location") {
      const form = root.querySelector("[data-location-form]");
      const city = form?.elements.city.value.trim();
      const neighborhood = form?.elements.neighborhood.value.trim();
      if (!city || city.length < 2) throw new Error("Informe uma cidade válida.");
      saveLocalSettings({defaultCity: city, defaultNeighborhood: neighborhood || null});
      locationCoordinates = null;
      locationLabel = neighborhood ? city + " · " + neighborhood : city;
      await loadPublicSalons();
      renderApp();
      setNotice("Região padrão salva neste aparelho.", "success");
    } else if (action === "save-profile") {
      const form = root.querySelector("[data-profile-form]");
      const fullName = form?.elements.fullName.value || "";
      const phone = form?.elements.phone.value || "";
      profileState = await updateMyProfile({ fullName, phone, email: profileState?.email || currentSession?.user?.email || null });
      renderApp();
      setNotice("Seus dados foram atualizados.", "success");
    } else if (action === "search-salons" || action === "retry-salon-search") {
      if (action === "search-salons") directoryState.query = root.querySelector("[data-salon-search] input[name=query]")?.value.trim() || "";
      await loadPublicSalons();
    } else if (action === "open-salon") {
      const salon = directoryState.items.find(item => item.slug === button?.dataset.slug && item.branch_id === button?.dataset.branchId);
      if (!salon) throw new Error("Este salão não está mais disponível na busca. Atualize os resultados.");
      await loadSalonCatalog(salon);
    } else if (action === "back-home") {
      activePage = "home";
      renderApp();
    } else if (action === "view-slots") {
      const serviceId = button?.dataset.serviceId;
      const card = serviceId ? root.querySelector('[data-service-card="' + CSS.escape(serviceId) + '"]') : null;
      const date = card?.querySelector('input[name="date"]')?.value || "";
      const professionalId = card?.querySelector('select[name="professionalId"]')?.value || null;
      if (!date) throw new Error("Escolha a data para consultar os horários.");
      slotsState = { serviceId, items: [], loading: true, error: "", date };
      renderApp();
      try {
        slotsState.items = await getCustomerAvailableSlots({
          orgId: salonDetailState.salon.org_id, branchId: salonDetailState.salon.branch_id,
          serviceId, professionalId, date, intervalMinutes: 15
        });
      } catch (error) {
        slotsState.error = error?.message || "Não foi possível consultar horários.";
      } finally {
        slotsState.loading = false;
        renderApp();
      }
    } else if (action === "create-hold") {
      if (holdState?.holdId) { try { await cancelAppointmentHold(holdState.holdId); } catch { /* A reserva anterior expira automaticamente no banco. */ } holdState = null; }
      const index = Number(button?.dataset.slotIndex);
      const slot = slotsState.items[index];
      if (!slot || !slotsState.serviceId) throw new Error("Selecione um horário válido.");
      const createdHold = await createAppointmentHold({
        orgId: salonDetailState.salon.org_id, branchId: salonDetailState.salon.branch_id,
        professionalId: slot.professional_id, serviceId: slotsState.serviceId, startsAt: slot.starts_at
      });
      holdState = { ...createdHold, orgId: salonDetailState.salon.org_id, branchId: salonDetailState.salon.branch_id };
      renderApp();
      setNotice("Horário reservado temporariamente. Confirme antes do vencimento.", "success");
    } else if (action === "confirm-booking") {
      if (!holdState?.holdId) throw new Error("A reserva temporária não está mais disponível.");
      if (!String(profileState?.fullName || "").trim()) {
        activePage = "profile";
        await loadProfile();
        renderApp();
        setNotice("Complete seu nome no perfil antes de confirmar o agendamento.", "info");
        return;
      }
      await confirmAppointmentHold(holdState.holdId);
      holdState = null;
      activePage = "appointments";
      await loadAppointments();
      renderApp();
      setNotice("Agendamento confirmado com sucesso.", "success");
    } else if (action === "cancel-hold") {
      const cancelled = holdState?.holdId ? await cancelAppointmentHold(holdState.holdId) : false;
      holdState = null;
      renderApp();
      setNotice(cancelled ? "Reserva temporária cancelada." : "A reserva já estava encerrada ou havia expirado.", cancelled ? "success" : "info");
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
  const salonSearchForm = event.target.closest("[data-salon-search]");
  if (!locationForm && !profileForm && !salonSearchForm) return;
  event.preventDefault();
  if (profileForm) runAction("save-profile", profileForm.querySelector('button[type="submit"]'));
  else if (salonSearchForm) runAction("search-salons", salonSearchForm.querySelector('button[type="submit"]'));
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
      await loadPublicSalons();
      renderApp();
    } else renderLogin();
    subscribeToAuthChanges(async session => {
      currentSession = session;
      if (session) {
        await loadProfile();
        await loadPublicSalons();
        renderApp();
      } else {
        profileState = null;
        identityLinkRequests = [];
        holdState = null;
        appointmentsState = { items: [], loading: false, error: "" };
        renderLogin();
      }
    });
  } catch {
    renderLogin("Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.");
  }
}

start();
