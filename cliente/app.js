/**
 * Compositor principal da Área da Cliente.
 * Responsabilidade: controlar sessão, navegação, ações e estados globais simples.
 * Cada tela, serviço, componente e estilo fica em arquivo próprio.
 */
import { getCurrentUser, subscribeToAuthChanges, signInWithGoogle, signInWithPasskey, registerPasskey, signOut } from "./services/authService.js";
import { supabase } from "../src/supabase/client.js";
import { getCurrentPosition } from "./services/geoSalonService.js";
import { getLocalSettings, saveLocalSettings, getRemoteSettings, saveRemoteSettings, setSettingsAccount } from "./services/settingsService.js";
import { listFavorites, addFavorite, removeFavorite } from "./services/favoritesService.js";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "./services/notificationService.js";
import { validatePublicCoupon } from "./services/couponService.js";
import { renderBottomNavigation } from "./ui/bottomNavigation.js";
import { renderLoginView } from "./ui/loginView.js";
import { renderHomeView } from "./ui/homeView.js";
import { renderSalonDetailView } from "./ui/salonDetailView.js";
import { searchPublicSalons, getPublicSalonCatalog } from "./services/salonDirectoryService.js";
import { getCustomerAvailableSlots, createAppointmentHold, confirmAppointmentHold, cancelAppointmentHold } from "./services/appointmentHoldService.js";
import { renderAppointmentsView } from "./ui/appointmentsView.js";
import { fetchMyCustomerAppointments } from "./services/appointmentsService.js";
import { fetchAppointmentChangeOptions, fetchRescheduleSlots, changeCustomerAppointment } from "./services/appointmentChangesService.js";
import { renderCustomerProfileView } from "./ui/customerProfileView.js";
import { renderFavoritesView } from "./ui/favoritesView.js";
import { renderNotificationsView } from "./ui/notificationsView.js";
import { ensureMyProfile, updateMyProfile } from "./services/customerProfileService.js";
import { installGlobalMasks } from "../src/utils/input-masks.js";
import { listMyPendingIdentityLinks, confirmMyIdentityLink } from "./services/customerIdentityLinkService.js";
import { renderIdentityLinkRequestsView } from "./ui/identityLinkRequestsView.js";

installGlobalMasks();
const root = document.querySelector("#cliente-app");
let currentSession = null;
let activePage = "home";
let busy = false;
let locationLabel = "Ative a localização ou escolha sua cidade";
let profileState = null;
let identityLinkRequests = [];
let appointmentsState = { items: [], loading: false, error: "" };
let changeOptions=[];
let appointmentChange=null;
let appointmentsRequest=0;
let directoryState = { items: [], loading: false, error: "", query: "" };
let locationCoordinates = null;
let salonDetailState = { salon: null, catalog: [], loading: false, error: "" };
let slotsState = { serviceId: null, items: [], loading: false, error: "", date: "" };
let holdState = null;
let favoritesState = { items: [], loading: false, error: "" };
let favoriteOrgIds = new Set();
let notificationsState = { items: [], loading: false, error: "" };
let couponState = { serviceId: null, code: "", preview: null, loading: false, error: "" };
let sessionEpoch=0;
let currentUserId=null;
let directoryRequest=0;
let catalogRequest=0;

/** Invalida respostas antigas e elimina dados de outra identidade antes de mostrar a nova sessão. */
function resetAccountState(userId){
  sessionEpoch++; directoryRequest++; catalogRequest++;
  currentUserId=userId; setSettingsAccount(userId);
  activePage="home"; busy=false; profileState=null; identityLinkRequests=[];
  locationCoordinates=null;
  const settings=getLocalSettings();
  locationLabel=settings.defaultCity||"Ative a localização ou escolha sua cidade";
  appointmentsState={items:[],loading:false,error:""};
  changeOptions=[];appointmentChange=null;appointmentsRequest++;
  directoryState={items:[],loading:false,error:"",query:""};
  salonDetailState={salon:null,catalog:[],loading:false,error:""};
  slotsState={serviceId:null,items:[],loading:false,error:"",date:"",professionalId:null};
  holdState=null; favoritesState={items:[],loading:false,error:""}; favoriteOrgIds=new Set();
  notificationsState={items:[],loading:false,error:""};
  couponState={serviceId:null,code:"",preview:null,loading:false,error:""};
}
function isCurrent(epoch){return epoch===sessionEpoch;}
/** Impede que uma ação iniciada por uma conta continue após a troca de identidade. */
function requireCurrent(epoch){
  if(!isCurrent(epoch))throw new Error("A sessão mudou durante a operação.");
}

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
  if (!currentSession || !currentUserId) return;
  let page;
  if (activePage === "appointments") page = renderAppointmentsView({ appointments: appointmentsState.items, loading: appointmentsState.loading, error: appointmentsState.error, changeOptions, change: appointmentChange });
  else if (activePage === "identity-links") page = renderIdentityLinkRequestsView({requests: identityLinkRequests});
  else if (activePage === "profile") {
    page = renderCustomerProfileView({profile: profileState, session: currentSession, theme: getLocalSettings().theme});
  } else if (activePage === "favorites") page = renderFavoritesView(favoritesState);
  else if (activePage === "notifications") page = renderNotificationsView(notificationsState);
  else if (activePage === "salon-detail") page = renderSalonDetailView({ ...salonDetailState, slots: slotsState, hold: holdState, isFavorite: favoriteOrgIds.has(salonDetailState.salon?.org_id), couponState });
  else page = renderHomeView({ locationLabel, salons: directoryState.items, loading: directoryState.loading, error: directoryState.error, query: directoryState.query });

  root.innerHTML =
    '<div class="client-app-shell">' +
      '<header class="app-header"><div class="client-brand compact-brand"><span class="brand-mark">SP</span><div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>' +
      '<button class="icon-button" data-action="profile" aria-label="Abrir perfil">○</button></header>' +
      '<div class="client-alert" data-notice role="status" hidden></div>' +
      '<main>' + page + '</main><div data-bottom-nav></div>' +
    '</div>';

  const navigation = renderBottomNavigation(activePage, async pageId => {
    if(busy||!currentUserId)return;
    const epoch=sessionEpoch;
    appointmentChange=null;
    activePage = pageId;
    if (pageId === "profile") await loadProfile();
    if (pageId === "appointments") await loadAppointments();
    if (pageId === "home") await loadPublicSalons();
    if(isCurrent(epoch))renderApp();
  });
  root.querySelector("[data-bottom-nav]").append(navigation);
  applyTheme();
}

/** Prepara o perfil global idempotentemente; RLS restringe a operação à sessão atual. */
async function loadProfile() {
  const epoch=sessionEpoch,userId=currentUserId;
  try {
    const profile=await ensureMyProfile(userId);
    if(!isCurrent(epoch))return;
    profileState=profile;
    try {
      const remoteSettings = await getRemoteSettings({client:supabase});
      if (!isCurrent(epoch))return;
      if (remoteSettings) saveLocalSettings(remoteSettings);
      const settings=getLocalSettings();
      if(!locationCoordinates&&settings.defaultCity)locationLabel=[settings.defaultCity,settings.defaultNeighborhood].filter(Boolean).join(" · ");
    } catch (settingsError) {
      if (settingsError?.message && !settingsError.message.includes("ainda está sendo ativada")) console.warn("Preferências remotas indisponíveis.", settingsError?.code || "PREFERENCES_ERROR");
    }
  } catch (error) {
    if(!isCurrent(epoch))return;
    profileState = null;
    if (error?.code !== "CUSTOMER_PROFILE_NOT_READY") {
      console.warn("Falha ao preparar perfil global.", error?.code || "PROFILE_ERROR");
    }
  }
}

/** Consulta somente salões e unidades que ativaram a publicação pública. */
async function loadPublicSalons() {
  const epoch=sessionEpoch,request=++directoryRequest;
  const current=()=>isCurrent(epoch)&&request===directoryRequest;
  directoryState = { ...directoryState, loading: true, error: "" };
  if (activePage === "home") renderApp();
  try {
    const settings = getLocalSettings();
    const items = await searchPublicSalons({
      client: supabase, query: directoryState.query,
      city: locationCoordinates ? null : settings.defaultCity || null,
      latitude: locationCoordinates?.latitude ?? null,
      longitude: locationCoordinates?.longitude ?? null,
      limit: 30
    });
    if(current())directoryState.items=items;
  } catch (error) {
    if(!current())return;
    directoryState.items = [];
    directoryState.error = error?.message || "Não foi possível buscar salões publicados.";
  } finally {
    if(current()){directoryState.loading = false;
      if (activePage === "home") renderApp();}
  }
}

/** Carrega o catálogo público da unidade selecionada sem consultar tabelas operacionais diretamente. */
async function loadSalonCatalog(salon) {
  const epoch=sessionEpoch,request=++catalogRequest;
  const current=()=>isCurrent(epoch)&&request===catalogRequest;
  if (holdState && (holdState.orgId !== salon.org_id || holdState.branchId !== salon.branch_id)) {
    const previousHold = holdState;
    holdState = null;
    try { await cancelAppointmentHold(previousHold.holdId); }
    catch { console.warn("Não foi possível cancelar a reserva anterior automaticamente."); }
  }
  if(!current())return;
  salonDetailState = { salon, catalog: [], loading: true, error: "" };
  slotsState = { serviceId: null, items: [], loading: false, error: "", date: "" };
  couponState = {serviceId:null,code:"",preview:null,loading:false,error:""};
  activePage = "salon-detail";
  renderApp();
  try {
    const catalog=await getPublicSalonCatalog({ client: supabase, slug: salon.slug, branchId: salon.branch_id });
    if(current())salonDetailState.catalog=catalog;
  } catch (error) {
    if(!current())return;
    salonDetailState.error = error?.message || "Não foi possível carregar o catálogo deste salão.";
  } finally {
    if(current()){salonDetailState.loading=false; if(activePage==="salon-detail")renderApp();}
  }
}

/** Carrega favoritos da identidade global sem bloquear a navegação se o módulo estiver em ativação. */
async function loadFavorites() {
  const epoch=sessionEpoch;
  favoritesState = { ...favoritesState, loading: true, error: "" };
  try {
    const items = await listFavorites({client:supabase});
    if(!isCurrent(epoch))return;
    favoritesState.items=items;
    favoriteOrgIds = new Set(favoritesState.items.map(item=>item.org_id));
  } catch (error) {
    if(!isCurrent(epoch))return;
    favoritesState.items = [];
    favoriteOrgIds = new Set();
    favoritesState.error = error?.message || "Não foi possível carregar seus favoritos.";
  } finally {
    if(!isCurrent(epoch))return;
    favoritesState.loading = false;
    if (activePage === "favorites") renderApp();
  }
}

/** Carrega notificações internas da cliente, mantendo a tela em estado seguro quando a migration não existe. */
async function loadNotifications() {
  const epoch=sessionEpoch;
  notificationsState = { ...notificationsState, loading: true, error: "" };
  try {
    const items = await listNotifications({client:supabase,limit:50});
    if(!isCurrent(epoch))return;
    notificationsState.items=items;
  } catch (error) {
    if(!isCurrent(epoch))return;
    notificationsState.items = [];
    notificationsState.error = error?.message || "Não foi possível carregar notificações.";
  } finally {
    if(!isCurrent(epoch))return;
    notificationsState.loading = false;
    if (activePage === "notifications") renderApp();
  }
}

/**** Carrega o histórico vinculado à identidade atual e mantém estados de carregamento/erro. */
async function loadAppointments() {
  const epoch=sessionEpoch,request=++appointmentsRequest;
  const current=()=>isCurrent(epoch)&&request===appointmentsRequest;
  appointmentChange=null;changeOptions=[];
  appointmentsState={...appointmentsState,loading:true,error:""};
  if(activePage==="appointments")renderApp();
  try{
    const items=await fetchMyCustomerAppointments({client:supabase});
    if(!current())return;
    appointmentsState.items=items;
    // Falha nas opções de alteração não impede a leitura do histórico.
    try{const options=await fetchAppointmentChangeOptions({client:supabase});if(current())changeOptions=options;}
    catch{if(current())changeOptions=[];}
  }catch(error){
    if(current()){appointmentsState.items=[];appointmentsState.error=error?.message||"Não foi possível carregar seus agendamentos.";}
  }finally{
    if(current()){appointmentsState.loading=false;if(activePage==="appointments")renderApp();}
  }
}

/** Executa ações da interface com bloqueio contra cliques repetidos e mensagens seguras. */
async function runAction(action, button = null) {
  if (busy) return;
  if(!currentUserId&&!["google","passkey"].includes(action))return;
  const epoch=sessionEpoch,userId=currentUserId;
  busy = true;
  if (button) button.disabled = true;
  try {
    if (action === "google") await signInWithGoogle();
    else if (action === "passkey") await signInWithPasskey();
    else if (action === "register-passkey") {
      await registerPasskey();
      requireCurrent(epoch);
      renderApp();
      setNotice("Chave de acesso cadastrada com sucesso.", "success");
    } else if (action === "sign-out") {
      if (holdState?.holdId) { try { await cancelAppointmentHold(holdState.holdId); } catch { /* A reserva expira no banco. */ } }
      requireCurrent(epoch);
      await signOut();
      if(isCurrent(epoch)){currentSession=null;resetAccountState(null);renderLogin();}
      return;
    } else if (action === "locate") {
      const position = await getCurrentPosition();
      requireCurrent(epoch);
      locationCoordinates = { latitude: position.latitude, longitude: position.longitude };
      locationLabel = "Localização obtida (precisão aproximada: " + Math.round(position.accuracy) + " m)";
      await loadPublicSalons();
      requireCurrent(epoch);
      renderApp();
      setNotice("Busca próxima atualizada. A localização foi usada somente nesta consulta.", "success");
    } else if (action === "save-location") {
      const form = root.querySelector("[data-location-form]");
      const city = form?.elements.city.value.trim();
      const neighborhood = form?.elements.neighborhood.value.trim();
      if (!city || city.length < 2) throw new Error("Informe uma cidade válida.");
      saveLocalSettings({defaultCity: city, defaultNeighborhood: neighborhood || null});
      try { await saveRemoteSettings({client:supabase,patch:{defaultCity:city,defaultNeighborhood:neighborhood||null}}); } catch { /* A preferência local permanece disponível até a RPC remota ser implantada. */ }
      requireCurrent(epoch);
      locationCoordinates = null;
      locationLabel = neighborhood ? city + " · " + neighborhood : city;
      await loadPublicSalons();
      requireCurrent(epoch);
      renderApp();
      setNotice("Região padrão salva neste aparelho.", "success");
    } else if (action === "save-profile") {
      const form = root.querySelector("[data-profile-form]");
      const fullName = form?.elements.fullName.value || "";
      const phone = form?.elements.phone.value || "";
      const updatedProfile=await updateMyProfile({ fullName, phone, email: profileState?.email || currentSession?.user?.email || null },userId);
      requireCurrent(epoch);profileState=updatedProfile;
      renderApp();
      setNotice("Seus dados foram atualizados.", "success");
    } else if (action === "search-salons" || action === "retry-salon-search") {
      if (action === "search-salons") directoryState.query = root.querySelector("[data-salon-search] input[name=query]")?.value.trim() || "";
      await loadPublicSalons();
      requireCurrent(epoch);
    } else if (action === "open-salon") {
      const salon = directoryState.items.find(item => item.slug === button?.dataset.slug && item.branch_id === button?.dataset.branchId);
      if (!salon) throw new Error("Este salão não está mais disponível na busca. Atualize os resultados.");
      await loadSalonCatalog(salon);
      requireCurrent(epoch);
    } else if (action === "favorites") {
      activePage = "favorites";
      await loadFavorites();
      requireCurrent(epoch);
      renderApp();
    } else if (action === "open-favorite") {
      const salon = favoritesState.items.find(item=>item.org_id===button?.dataset.orgId&&item.branch_id===button?.dataset.branchId);
      if(!salon)throw new Error("Esta unidade não está mais disponível nos seus favoritos.");
      await loadSalonCatalog(salon);
      requireCurrent(epoch);
    } else if (action === "toggle-favorite") {
      const orgId=button?.dataset.orgId||salonDetailState.salon?.org_id;
      if(!orgId)throw new Error("Não foi possível identificar o salão.");
      if(favoriteOrgIds.has(orgId))await removeFavorite({client:supabase,orgId});
      else await addFavorite({client:supabase,orgId});
      requireCurrent(epoch);
      await loadFavorites();
      requireCurrent(epoch);
      renderApp();
      setNotice(favoriteOrgIds.has(orgId)?"Salão adicionado aos favoritos.":"Salão removido dos favoritos.","success");
    } else if (action === "remove-favorite") {
      const orgId=button?.dataset.orgId;
      if(!orgId)throw new Error("Não foi possível identificar o salão.");
      await removeFavorite({client:supabase,orgId});
      requireCurrent(epoch);
      await loadFavorites();
      requireCurrent(epoch);
      renderApp();
      setNotice("Salão removido dos favoritos.","success");
    } else if (action === "notifications") {
      activePage = "notifications";
      await loadNotifications();
      requireCurrent(epoch);
      renderApp();
    } else if (action === "mark-notification-read") {
      await markNotificationRead({client:supabase,notificationId:button?.dataset.notificationId});
      requireCurrent(epoch);
      await loadNotifications();
      requireCurrent(epoch);
      renderApp();
    } else if (action === "mark-all-notifications-read") {
      await markAllNotificationsRead({client:supabase});
      requireCurrent(epoch);
      await loadNotifications();
      requireCurrent(epoch);
      renderApp();
      setNotice("Todas as notificações foram marcadas como lidas.","success");
    } else if (action === "back-profile") {
      activePage = "profile";
      await loadProfile();
      requireCurrent(epoch);
      renderApp();
    } else if (action === "back-home") {
      activePage = "home";
      renderApp();
    } else if (action === "validate-coupon") {
      const serviceId=button?.dataset.serviceId;
      const card=serviceId?root.querySelector('[data-service-card="'+CSS.escape(serviceId)+'"]'):null;
      const code=card?.querySelector('input[name="couponCode"]')?.value.trim().toUpperCase()||"";
      if(!code)throw new Error("Digite o código do cupom.");
      couponState={serviceId,code,preview:null,loading:true,error:""};
      renderApp();
      try {
        const preview=await validatePublicCoupon({
          client:supabase,orgId:salonDetailState.salon.org_id,
          branchId:salonDetailState.salon.branch_id,serviceId,code
        });
        requireCurrent(epoch);couponState.preview=preview;
        setNotice("Cupom válido. O desconto será reservado junto com o horário.","success");
      } catch(error) {
        if(!isCurrent(epoch))return;
        couponState.error=error?.message||"Não foi possível validar o cupom.";
      } finally {
        if(isCurrent(epoch)){couponState.loading=false;renderApp();}
      }
    } else if (action === "view-slots") {
      const serviceId = button?.dataset.serviceId;
      if(couponState.serviceId!==serviceId)couponState={serviceId:null,code:"",preview:null,loading:false,error:""};
      const card = serviceId ? root.querySelector('[data-service-card="' + CSS.escape(serviceId) + '"]') : null;
      const date = card?.querySelector('input[name="date"]')?.value || "";
      const professionalId = card?.querySelector('select[name="professionalId"]')?.value || null;
      if (!date) throw new Error("Escolha a data para consultar os horários.");
      slotsState = { serviceId, items: [], loading: true, error: "", date,professionalId };
      renderApp();
      try {
        const items=await getCustomerAvailableSlots({
          orgId: salonDetailState.salon.org_id, branchId: salonDetailState.salon.branch_id,
          serviceId, professionalId, date, intervalMinutes: 15
        });
        requireCurrent(epoch);slotsState.items=items;
      } catch (error) {
        if(!isCurrent(epoch))return;
        slotsState.error = error?.message || "Não foi possível consultar horários.";
      } finally {
        if(isCurrent(epoch)){slotsState.loading=false;renderApp();}
      }
    } else if (action === "create-hold") {
      if (holdState?.holdId) { try { await cancelAppointmentHold(holdState.holdId); } catch { /* A reserva anterior expira automaticamente no banco. */ } requireCurrent(epoch);holdState = null; }
      const index = Number(button?.dataset.slotIndex);
      const slot = Number.isInteger(index)&&index>=0 ? slotsState.items[index] : null;
      if (!slot || !slotsState.serviceId) throw new Error("Selecione um horário válido.");
      const serviceCard=root.querySelector('[data-service-card="'+CSS.escape(slotsState.serviceId)+'"]');
      const changedDate=serviceCard?.querySelector('input[name="date"]')?.value!==slotsState.date;
      const changedProfessional=(serviceCard?.querySelector('select[name="professionalId"]')?.value||null)!==(slotsState.professionalId||null);
      if(changedDate||changedProfessional)throw new Error("A seleção mudou. Consulte novamente os horários disponíveis.");
      const enteredCode=serviceCard?.querySelector('input[name="couponCode"]')?.value.trim().toUpperCase()||"";
      const couponCode=couponState.serviceId===slotsState.serviceId&&couponState.code===enteredCode&&couponState.preview?couponState.code:null;
      if(enteredCode&&!couponCode)throw new Error("Aplique e valide novamente o cupom antes de reservar o horário.");
      const createdHold = await createAppointmentHold({
        orgId: salonDetailState.salon.org_id, branchId: salonDetailState.salon.branch_id,
        professionalId: slot.professional_id, serviceId: slotsState.serviceId, startsAt: slot.starts_at,
        couponCode
      });
      requireCurrent(epoch);
      holdState = {
        ...createdHold,
        startsAt:slot.starts_at,professionalName:slot.professional_name,
        orgId: salonDetailState.salon.org_id,
        branchId: salonDetailState.salon.branch_id,
        serviceId: slotsState.serviceId
      };
      renderApp();
      setNotice("Horário reservado temporariamente. Confirme antes do vencimento.", "success");
    } else if (action === "confirm-booking") {
      if (!holdState?.holdId) throw new Error("A reserva temporária não está mais disponível.");
      if(!Number.isFinite(Date.parse(holdState.expiresAt))||Date.parse(holdState.expiresAt)<=Date.now()){
        holdState=null;renderApp();throw new Error("Sua reserva expirou. Consulte os horários novamente.");
      }
      if (!String(profileState?.fullName || "").trim() || profileState.fullName.trim()==="Cliente") {
        activePage = "profile";
        await loadProfile();
      requireCurrent(epoch);
        renderApp();
        setNotice("Complete seu nome no perfil antes de confirmar o agendamento.", "info");
        return;
      }
      await confirmAppointmentHold(holdState.holdId);
      requireCurrent(epoch);
      holdState = null;
      activePage = "appointments";
      await loadAppointments();
      requireCurrent(epoch);
      renderApp();
      setNotice("Agendamento confirmado com sucesso.", "success");
    } else if (action === "cancel-hold") {
      const cancelled = holdState?.holdId ? await cancelAppointmentHold(holdState.holdId) : false;
      requireCurrent(epoch);holdState = null;
      renderApp();
      setNotice(cancelled ? "Reserva temporária cancelada." : "A reserva já estava encerrada ou havia expirado.", cancelled ? "success" : "info");
    } else if (action === "open-cancel-appointment" || action === "open-reschedule-appointment") {
      const id=button?.dataset.appointmentId;
      const item=appointmentsState.items.find(row=>row.appointment_id===id);
      const allowed=changeOptions.find(row=>row.appointment_id===id);
      const cancel=action==="open-cancel-appointment";
      if(!item||!allowed||(cancel?!allowed.can_cancel:!allowed.can_reschedule))throw new Error("Este agendamento não pode ser alterado pelo aplicativo.");
      appointmentChange={appointmentId:id,action:cancel?"cancel":"reschedule",expectedStart:item.starts_at,timezone:allowed.timezone,date:"",slots:[],newStart:null,searched:false};
      renderApp();
    } else if(action==="close-appointment-change"){
      appointmentChange=null;renderApp();
    } else if(action==="load-reschedule-slots"){
      const change=appointmentChange;
      if(change?.action!=="reschedule")return;
      const date=root.querySelector('input[name="rescheduleDate"]')?.value||"";
      if(!date)throw new Error("Escolha uma data.");
      Object.assign(change,{date,slots:[],newStart:null,loading:true,error:"",searched:false});renderApp();
      try{
        const slots=await fetchRescheduleSlots({client:supabase,appointmentId:change.appointmentId,date});
        if(isCurrent(epoch)&&appointmentChange===change)Object.assign(change,{slots,searched:true});
      }catch(error){
        if(isCurrent(epoch)&&appointmentChange===change)change.error=error.message;
      }finally{
        if(isCurrent(epoch)&&appointmentChange===change){change.loading=false;renderApp();}
      }
    } else if(action==="select-reschedule-slot"){
      const change=appointmentChange,index=Number(button?.dataset.slotIndex);
      if(!change||!Number.isInteger(index)||!change.slots[index])throw new Error("Escolha um horário válido.");
      if(root.querySelector('input[name="rescheduleDate"]')?.value!==change.date)throw new Error("A data mudou. Consulte os horários novamente.");
      change.newStart=change.slots[index].starts_at;renderApp();
    } else if(action==="submit-appointment-change"){
      const change=appointmentChange;
      if(!change)throw new Error("Selecione um agendamento.");
      if(change.action==="reschedule"&&(!change.newStart||root.querySelector('input[name="rescheduleDate"]')?.value!==change.date))throw new Error("Consulte e selecione o novo horário.");
      await changeCustomerAppointment({client:supabase,appointmentId:change.appointmentId,action:change.action,expectedStart:change.expectedStart,newStart:change.newStart});
      requireCurrent(epoch);appointmentChange=null;
      await loadAppointments();requireCurrent(epoch);
      setNotice(change.action==="cancel"?"Agendamento cancelado.":"Agendamento reagendado.","success");
    } else if (action === "reload-appointments") {
      await loadAppointments();
      requireCurrent(epoch);
    } else if (action === "theme") {
      const current = getLocalSettings().theme;
      const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
      saveLocalSettings({theme: next});
      try { await saveRemoteSettings({client:supabase,patch:{theme:next}}); } catch { /* O tema local continua funcionando sem sincronização remota. */ }
      requireCurrent(epoch);
      renderApp();
      setNotice("Aparência atualizada.", "success");
    } else if (action === "profile") {
      activePage = "profile";
      await loadProfile();
      requireCurrent(epoch);
      renderApp();
    } else if (action === "identity-links") {
      activePage = "identity-links";
      const requests=await listMyPendingIdentityLinks();
      requireCurrent(epoch);identityLinkRequests=requests;
      renderApp();
    } else if (action === "confirm-identity-link") {
      const requestId = button?.dataset.requestId;
      if (!requestId) throw new Error("Selecione uma solicitação válida para confirmar.");
      await confirmMyIdentityLink(requestId);
      requireCurrent(epoch);
      const requests=await listMyPendingIdentityLinks();
      requireCurrent(epoch);identityLinkRequests=requests;
      renderApp();
      setNotice("Vínculo confirmado. O acesso continua limitado aos dados deste salão.", "success");
    }
  } catch (error) {
    if(!isCurrent(epoch))return;
    const message = error?.message || "Não foi possível concluir esta ação. Tente novamente.";
    if (!currentSession) renderLogin(message);
    else {
      renderApp();
      setNotice(message, "error");
    }
  } finally {
    if(isCurrent(epoch)){busy=false;if(button?.isConnected)button.disabled=false;}
  }
}

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

/** Eventos Auth são síncronos. Consultas são agendadas fora do lock do Supabase. */
function start(){
  renderLogin();
  subscribeToAuthChanges((session)=>{
    const id=session?.user?.id||null;
    if(id===currentUserId){currentSession=session;return;}
    resetAccountState(id);currentSession=session;
    if(!id){renderLogin();return;}
    const epoch=sessionEpoch;
    root.innerHTML='<main class="page-content"><div class="empty-state"><span class="spinner"></span><p>Verificando sua conta…</p></div></main>';
    setTimeout(async()=>{
      try{
        if(!isCurrent(epoch))return;
        const user=await getCurrentUser();
        requireCurrent(epoch);
        if(user?.id!==id)throw new Error("Sessão inválida.");
        await loadProfile();requireCurrent(epoch);
        await Promise.all([loadPublicSalons(),loadFavorites()]);requireCurrent(epoch);
        renderApp();
      }catch(error){
        if(!isCurrent(epoch))return;
        currentSession=null;resetAccountState(null);
        renderLogin("Não foi possível verificar sua sessão. Entre novamente.");
        try{await signOut();}catch{/* Não exibir dados privados quando encerrar a sessão falhar. */}
      }
    },0);
  });
}
start();
