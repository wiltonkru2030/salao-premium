/** App Profissional (PWA): autenticação, sessão individual, Agenda, Comandas, Comissões e configurações do próprio perfil. */
import {createCustomersController} from "./controllers/customers.controller.js";
import {createServicesController} from "./controllers/services.controller.js";
import {createNotificationsController} from "./controllers/notifications.controller.js";
import {createProfileController} from "./controllers/profile.controller.js";
import {createFinancialController} from "./controllers/financial.controller.js";
import {salonCalendarDate, salonTimezone} from "./utils/salon-time.js";
import { createPlatformAppearance } from "../src/components/platform-appearance.js";
import {renderProfessionalShell, setProfessionalMenuOpen} from "./views/shell.views.js";
import { renderPlatformMark } from "../src/components/platform-mark.js";
import {authenticateProfessional} from "./auth.service.js";
import {fetchProfessionalContexts,verifyProfessionalSession,sameProfessionalScope,ProfessionalSessionError} from "./session.service.js";
import {requiresProfessionalPasswordChange,completeProfessionalPasswordChange} from "./password.service.js";
import {fetchProfessionalBranches,selectProfessionalBranch} from "./branches.service.js";
import { supabase } from "./supabase.client.js";
import {bindOrderService} from "./order-service.controller.js";
import {bindOrderManagement} from "./order-management.controller.js";
import {renderNotificationsView} from "./views/notifications.views.js";
import { installGlobalErrorHandlers, reportError } from "../src/utils/errors.js";
import { installGlobalMasks, formatCpf } from "../src/utils/input-masks.js";
import {
  escapeHtml as esc,
  formatMoney as money,
  toDateKey as dateKey,
  formatMonthLabel as monthLabel,
  formatDateLabel as dateLabel,
  formatTime as timeLabel,
  formatDateTime as dateTimeLabel,
  formatBookingSource as sourceLabel,
  formatStatus as statusLabel,
  getAppointmentClass as appointmentClass
} from "./utils/formatters.js";
import { renderProfessionalPasswordChangeView, renderProfessionalLoginView } from "./views/auth.views.js";
import {ordersView,commissionsView,profileView,settingsView} from "./views/workspace.views.js";
import { renderProfessionalCustomers } from "./views/customers.views.js";
import { renderProfessionalServices } from "./views/services.views.js";
import {bindProfessionalBookingSearch} from "./booking-search.js";
import {attendanceActions,performAttendanceAction} from "./attendance.service.js";
import {createAgendaWorkspaceViews} from "./views/agenda-workspace.views.js";
import { handleAgendaClick } from "./agenda.controller.js";
import { fetchProfessionalAppointments, updateOwnAppointmentStatus, rescheduleOwnAppointment, createOwnAppointment, createUnitAppointment } from "./appointments.service.js";
import { resolveProfessionalContexts, allowedProfessionalPages, canRegisterProfessionalService, summarizeProfessionalCommissions } from "./access.rules.js";

// Aplicação PWA do profissional: autenticação, navegação, Agenda, Comandas e Comissões.
installGlobalErrorHandlers();
installGlobalMasks();

const appearance = createPlatformAppearance("salao-premium:professional-appearance");
const root=document.querySelector("#professional-app");
const state={
 user:null,contextCount:0,branches:[],branchId:null,orgId:null,role:null,scope:"none",professional:null,profile:null,profilePreferences:null,profilePreferencesStatus:"idle",notifications:[],notificationsUnread:0,notificationsStatus:"idle",notificationsFilter:false,organization:null,
 page:"Agenda",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),
 selectedDate:new Date(),selectedAppointment:null,appointments:[],customers:[],customerHistory:[],selectedCustomer:null,customerEditor:null,customersStatus:"idle",customerHistoryStatus:"idle",orders:[],services:[],serviceCatalog:[],serviceEditor:null,serviceCatalogStatus:"idle",
 commissions:[],commissionPayouts:[],commissionStatus:"idle",commissionFilters:{from:"",to:"",status:"all",type:"all"},selectedPayout:null,selectedOrder:null,orderItems:[],notice:""
};
let disposeAutocomplete=null;
let sessionEpoch=0;
let recheckingSession=false;
let endingSession=false;
// Ative a interface no build após instalar a migration correspondente no Supabase.
const appointmentStatusEnabled = import.meta.env.VITE_PROFESSIONAL_APPOINTMENT_STATUS === "true";
let appointmentStatusPending = false;
// Ative após aplicar a migration de reagendamento no ambiente correspondente.
const bookingEnabled = import.meta.env.VITE_PROFESSIONAL_BOOKING === "true";
const customerRegistrationEnabled = import.meta.env.VITE_PROFESSIONAL_CUSTOMER_REGISTRATION === "true";
const notificationsEnabled = import.meta.env.VITE_PROFESSIONAL_NOTIFICATIONS === "true";
const profilePreferencesEnabled = import.meta.env.VITE_PROFESSIONAL_PROFILE_PREFERENCES === "true";
const orderManagementEnabled = import.meta.env.VITE_PROFESSIONAL_ORDER_MANAGEMENT === "true";
const attendanceEnabled = import.meta.env.VITE_PROFESSIONAL_ATTENDANCE === "true";
const serviceManagementEnabled = import.meta.env.VITE_PROFESSIONAL_SERVICE_MANAGEMENT === "true";
const unitBookingEnabled = import.meta.env.VITE_PROFESSIONAL_UNIT_BOOKING === "true";
const rescheduleEnabled = import.meta.env.VITE_PROFESSIONAL_RESCHEDULE === "true";
const serviceLock={active:false,operation:null};
const {agendaView,appointmentStatusActions}=createAgendaWorkspaceViews({state,attendanceEnabled,appointmentStatusEnabled,rescheduleEnabled,bookingEnabled,unitBookingEnabled,customerRegistrationEnabled});
// Controladores recebem a geração da sessão por função, nunca como valor congelado.
const {loadCustomers,openCustomer,submitProfessionalCustomer}=createCustomersController({state,supabase,getEpoch:()=>sessionEpoch,render,reportError,customerRegistrationEnabled});
const {loadServices,canManageServices,loadServiceCatalog,changeServiceLink,submitProfessionalService}=createServicesController({state,supabase,getEpoch:()=>sessionEpoch,render,reportError,showNotice,serviceManagementEnabled});
const {loadNotifications,readNotifications}=createNotificationsController({state,supabase,getEpoch:()=>sessionEpoch,render,showNotice,notificationsEnabled});
const {loadProfilePreferences,submitProfilePreferences}=createProfileController({state,supabase,getEpoch:()=>sessionEpoch,render,showNotice,profilePreferencesEnabled});
const {loadOrders,loadCommissions,loadOrderItems,chooseOrder}=createFinancialController({state,supabase,getEpoch:()=>sessionEpoch,render,reportError});

/** Limpa dados privados antes de exibir a tela de acesso. */
function clearPrivateState(){sessionEpoch++;appointmentStatusPending=false;serviceLock.active=false;serviceLock.operation=null;clearAutocomplete();Object.assign(state,{user:null,contextCount:0,branches:[],branchId:null,orgId:null,role:null,scope:"none",professional:null,profile:null,profilePreferences:null,profilePreferencesStatus:"idle",notifications:[],notificationsUnread:0,notificationsStatus:"idle",notificationsFilter:false,organization:null,page:"Agenda",appointments:[],customers:[],customerHistory:[],selectedCustomer:null,customerEditor:null,customersStatus:"idle",customerHistoryStatus:"idle",orders:[],services:[],serviceCatalog:[],serviceEditor:null,serviceCatalogStatus:"idle",commissions:[],commissionPayouts:[],commissionStatus:"idle",commissionFilters:{from:"",to:"",status:"all",type:"all"},selectedPayout:null,selectedAppointment:null,selectedOrder:null,orderItems:[]});}
/** Limpa a interface imediatamente; encerra apenas a sessão profissional local. */
async function endSession(notice=""){
 if(endingSession)return;
 endingSession=true;clearPrivateState();state.notice=notice;loginView();
 try{const {error}=await supabase.auth.signOut({scope:"local"});if(error)throw error;}
 catch{state.notice=notice||"Não foi possível confirmar o encerramento da sessão. Confira a conexão.";loginView();}
 finally{endingSession=false;}
}

// Formatadores puros são mantidos em professional/utils/formatters.js.
function showNotice(message){if(!state.user||!state.orgId)return;state.notice=message;render();}
function clearAutocomplete(){disposeAutocomplete?.();disposeAutocomplete=null;}
// Views de autenticação ficam isoladas do controlador principal do PWA.
function loginView(){
 clearAutocomplete();
 root.innerHTML=renderProfessionalLoginView(state.notice, appearance.preference);
}
function changePasswordView(){
 root.innerHTML=renderProfessionalPasswordChangeView(state.notice,{managed:state.user?.app_metadata?.professional_password_required===true});
}
/** Atualiza a moldura do app com as páginas autorizadas para esta sessão. */
function shell(content) {
 root.innerHTML=renderProfessionalShell({state,content,pages:allowedProfessionalPages(state)});
}

function render(){
 if(!state.user||!state.orgId)return;
 if(!allowedProfessionalPages(state).includes(state.page))state.page="Agenda";
 clearAutocomplete();
 const content=state.page==="Agenda"?agendaView():state.page==="Comandas"?ordersView(state,{managementEnabled:orderManagementEnabled}):state.page==="Comissões"?commissionsView(state):state.page==="Serviços"?renderProfessionalServices(state.services,{manage:canManageServices(),catalog:state.serviceCatalog,editor:state.serviceEditor,status:state.serviceCatalogStatus}):state.page==="Clientes"?renderProfessionalCustomers({...state,canManageCustomers:customerRegistrationEnabled&&state.role==="professional"&&!!state.professional?.branch_id}):state.page==="Notificações"?renderNotificationsView(state):state.page==="Perfil"?profileView(state,{preferencesEnabled:profilePreferencesEnabled}):settingsView(state, appearance.preference,{preferencesEnabled:profilePreferencesEnabled});
 shell(content);
 if(state.page==="Comandas"&&state.selectedOrder&&state.role==="professional"&&state.professional)bindAutocomplete();
}
// Resolve vínculo, escopo e permissões antes de liberar os módulos.
async function loadBase(selectedOrgId=null,selectedBranchId=null){
 const userId=state.user?.id;
 if(!userId)throw new Error("Sua sessão expirou.");
 // Retira dados do contexto anterior antes de consultar novas permissões.
 const user=state.user;clearPrivateState();state.user=user;
 const loadEpoch=sessionEpoch;
 root.innerHTML='<div class="boot" role="status">Carregando acesso ao salão…</div>';
 let contexts=await fetchProfessionalContexts(supabase,userId);
 if(loadEpoch!==sessionEpoch)return;
 const names=await supabase.from("organizations").select("id,name,timezone,currency").in("id",contexts.map(c=>c.orgId));
 if(loadEpoch!==sessionEpoch)return;
 if(names.error)throw new Error("Não foi possível consultar os salões vinculados.");
 const orgs=new Map((names.data||[]).map(o=>[o.id,o]));
 contexts=contexts.filter(c=>orgs.has(c.orgId));
 if(!contexts.length)throw new Error("Não foi possível identificar um salão autorizado.");
 state.contextCount=contexts.length;
 const context=selectedOrgId?contexts.find(c=>c.orgId===selectedOrgId):contexts.length===1?contexts[0]:null;
 if(!context){
  Object.assign(state,{orgId:null,role:null,scope:"none",professional:null,organization:null,profile:null,profilePreferences:null,profilePreferencesStatus:"idle",notifications:[],notificationsUnread:0,notificationsStatus:"idle",notificationsFilter:false,appointments:[],customers:[],customerHistory:[],selectedCustomer:null,customerEditor:null,customersStatus:"idle",customerHistoryStatus:"idle",orders:[],services:[],serviceCatalog:[],serviceEditor:null,serviceCatalogStatus:"idle",commissions:[],commissionPayouts:[],commissionStatus:"idle",commissionFilters:{from:"",to:"",status:"all",type:"all"},selectedPayout:null,selectedAppointment:null,selectedOrder:null,orderItems:[]});
  clearAutocomplete();
  root.innerHTML='<main class="login"><div class="brand sp-professional-brand">' + renderPlatformMark() + '<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div><h1>Escolha o salão</h1><p>Seus dados ficam separados por estabelecimento.</p>'+contexts.map(c=>'<button type="button" class="primary" data-context-org="'+esc(c.orgId)+'">'+esc(orgs.get(c.orgId)?.name||"Salão")+'</button>').join("")+'<button class="secondary" data-action="logout">Sair</button></main>';
  return;
 }
 Object.assign(state,context,{organization:orgs.get(context.orgId),notificationsEnabled,profilePreferences:null,profilePreferencesStatus:"idle",notifications:[],notificationsUnread:0,notificationsStatus:"idle",notificationsFilter:false,page:"Agenda",selectedAppointment:null,selectedOrder:null,orderItems:[],appointments:[],customers:[],customerHistory:[],selectedCustomer:null,customerEditor:null,customersStatus:"idle",customerHistoryStatus:"idle",orders:[],services:[],serviceCatalog:[],serviceEditor:null,serviceCatalogStatus:"idle",commissions:[],commissionPayouts:[],commissionStatus:"idle",commissionFilters:{from:"",to:"",status:"all",type:"all"},selectedPayout:null});
 if(state.role==="professional"){
  const branches=await fetchProfessionalBranches({client:supabase,organizationId:state.orgId,professional:state.professional});
  if(loadEpoch!==sessionEpoch)return;
  state.branches=branches;const branch=selectProfessionalBranch(branches,selectedBranchId);
  if(!branch){
   root.innerHTML='<main class="login"><div class="brand sp-professional-brand">'+renderPlatformMark()+'<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div><h1>Escolha a unidade</h1><p>Agenda e comandas serão filtradas pela unidade.</p>'+branches.map(row=>'<button type="button" class="primary" data-context-branch="'+esc(row.id)+'">'+esc(row.name)+'</button>').join("")+'<button class="secondary" data-action="logout">Sair</button></main>';
   return;
  }
  state.branchId=branch.id;
 }
 state.selectedDate=salonCalendarDate(new Date(),state.organization?.timezone);
 state.month=new Date(state.selectedDate.getFullYear(),state.selectedDate.getMonth(),1);
 const profileResult=await supabase.from("profiles").select("full_name,phone").eq("id",userId).maybeSingle();
 if(loadEpoch!==sessionEpoch)return;
 if(profileResult.error)throw new Error("Não foi possível carregar seu perfil.");
 state.profile=profileResult.data;
 const pages=allowedProfessionalPages(state);
 await Promise.all([loadAppointments(),...(pages.includes("Comandas")?[loadOrders()]:[]),...(state.role==="professional"?[loadServices()]:[]),...(pages.includes("Comissões")?[loadCommissions()]:[]),...(pages.includes("Notificações")?[loadNotifications()]:[])]);
 if(loadEpoch!==sessionEpoch)return;
 state.notice="";render();
}
// Carrega somente agendamentos permitidos pelo escopo profissional.
async function loadAppointments(){
 const epoch=sessionEpoch,month=state.month;
 const appointments=await fetchProfessionalAppointments({
  client:supabase,
  organizationId:state.orgId,
  month,branchId:state.branchId,timezone:salonTimezone(state.organization?.timezone),professionalId:state.scope==='self'?state.professional?.id:null
 });
 if(epoch===sessionEpoch&&month===state.month)state.appointments=appointments;
}
/** Monta o controlador de serviços da comanda atual. */
function bindAutocomplete(){
 disposeAutocomplete?.();
 disposeAutocomplete=orderManagementEnabled?bindOrderManagement({root,state,client:supabase,getEpoch:()=>sessionEpoch,lock:serviceLock,loadOrders,loadAppointments,chooseOrder,showNotice,reportError}):bindOrderService({root,state,client:supabase,getEpoch:()=>sessionEpoch,lock:serviceLock,loadOrders,chooseOrder,showNotice,reportError});
}
// Libera o conteúdo caso o aparelho passe para o layout de menu fixo.
matchMedia("(max-width:760px)").addEventListener("change", event=>{
 if(!event.matches&&root.querySelector(".app-shell.is-menu-open"))setProfessionalMenuOpen(root,false);
});
// Escape devolve o foco ao botão de menu quando a navegação móvel está aberta.
root.addEventListener("keydown", event => {
 if(event.key==="Escape"&&root.querySelector(".app-shell.is-menu-open"))setProfessionalMenuOpen(root,false);
});
// Filtra a lista em memória sem enviar buscas ao banco ou perder o foco.
root.addEventListener("input", event => {
 // CPF ou e-mail: formata apenas entradas numéricas e preserva o login por e-mail.
 if(event.target.matches("#professional-login [name=login]")&&!event.isComposing&&/^[0-9.\\-\\s]+$/.test(event.target.value)){event.target.value=formatCpf(event.target.value);return;}
 const control=event.target.closest("[data-professional-list-search]");
 if(!control)return;
 const normalize=value=>value.normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("pt-BR").trim();
 const term=normalize(control.value);
 const list=control.closest("[data-professional-list]");
 let visible=0;
 for(const item of list.querySelectorAll("[data-professional-search-text]")){
  const text=normalize(item.dataset.professionalSearchText);
  const digits=term.replace(/\D/g,"");
  const phoneMatch=digits&&/^[+()\d\s-]+$/.test(term)&&item.dataset.professionalPhone?.includes(digits);
  item.hidden=!text.includes(term)&&!phoneMatch;
  if(!item.hidden)visible++;
 }
 list.querySelector("[data-professional-search-empty]").hidden=visible>0||!term;
});
root.addEventListener("change", event => {
 if (event.target.matches("[data-platform-appearance]")) appearance.set(event.target.value);
});
/** Persiste a mudança e atualiza o cartão apenas se a sessão ainda for a mesma. */
async function applyAppointmentStatus(control) {
 const appointment=state.selectedAppointment;
 if(!appointmentStatusEnabled || !appointment || appointmentStatusPending || !appointmentStatusActions(appointment))return;
 const status=control.dataset.ownAppointmentStatus;
 if(status==="cancelled"&&!window.confirm("Cancelar este agendamento?"))return;
 const epoch=sessionEpoch;
 appointmentStatusPending=true;
 control.disabled=true;
 try {
  const saved=await updateOwnAppointmentStatus({client:supabase,organizationId:state.orgId,appointmentId:appointment.id,status});
  if(epoch!==sessionEpoch)return;
  state.appointments=state.appointments.map(item=>item.id===saved.id?{...item,...saved}:item);
  if(state.selectedAppointment?.id===saved.id)state.selectedAppointment={...appointment,...saved};
  showNotice(status==="confirmed"?"Agendamento confirmado.":"Agendamento cancelado.");
 } catch(error) {
  if(epoch===sessionEpoch)showNotice(error.message);
 } finally {
  appointmentStatusPending=false;
  if(control.isConnected)control.disabled=false;
 }
}

/** Atualiza Agenda e Comandas após confirmação do servidor, sem registrar pagamentos. */
async function applyAttendance(control){
 const appointment=state.selectedAppointment,operation=control.dataset.attendanceAction;
 if(!attendanceEnabled||state.page!=="Agenda"||appointmentStatusPending||!attendanceActions(state,appointment).includes(operation))return;
 if(operation==="finish"&&!window.confirm("Finalizar o atendimento e encaminhar a comanda ao Caixa?"))return;
 const epoch=sessionEpoch;
 appointmentStatusPending=true;control.disabled=true;
 try{
  const saved=await performAttendanceAction({client:supabase,organizationId:state.orgId,appointmentId:appointment.id,operation});
  if(epoch!==sessionEpoch)return;
  const patch={status:saved.status,service_order_id:saved.order_id};
  state.appointments=state.appointments.map(item=>item.id===appointment.id?{...item,...patch}:item);
  if(state.selectedAppointment?.id===appointment.id)state.selectedAppointment={...state.selectedAppointment,...patch};
  const message=operation==="start"?"Atendimento iniciado. Abra a comanda para registrar outros serviços.":"Atendimento concluído. Comanda encaminhada ao Caixa.";
  try{await loadOrders();if(epoch===sessionEpoch)showNotice(message);}
  catch(error){if(epoch===sessionEpoch)showNotice(message+" Atualize Comandas para consultar os itens.");}
 }catch(error){if(epoch===sessionEpoch)showNotice(error.message);}
 finally{appointmentStatusPending=false;if(control.isConnected)control.disabled=false;}
}
/** Abre a comanda vinculada somente se estiver visível no contexto autorizado. */
async function openAttendanceOrder(){
 const appointment=state.selectedAppointment,epoch=sessionEpoch;
 if(!attendanceEnabled||!appointment?.service_order_id||state.page!=="Agenda"||!attendanceActions(state,appointment).includes("order"))return;
 try{
  await loadOrders();
  if(epoch!==sessionEpoch||state.page!=="Agenda"||state.selectedAppointment?.id!==appointment.id)return;
  if(!state.orders.some(order=>order.id===appointment.service_order_id)){showNotice("Comanda não encontrada na lista recente. Consulte a recepção.");return;}
  state.page="Comandas";state.selectedAppointment=null;state.notice="";
  await chooseOrder(appointment.service_order_id);
 }catch(error){if(epoch===sessionEpoch)showNotice("Não foi possível carregar a comanda. Tente novamente.");}
}
root.addEventListener("click",async event=>{
 try{
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="open-professional-menu"||action==="close-professional-menu"){
   setProfessionalMenuOpen(root,action==="open-professional-menu");
   return;
  }
  if(action==="open-professional-booking"||action==="close-professional-booking"){
   const dialog=root.querySelector("#professional-booking-dialog");
   if(action==="open-professional-booking"&&dialog&&!dialog.open){
    const epoch=sessionEpoch;
    bindProfessionalBookingSearch(dialog.querySelector("#professional-new-appointment"),state,{client:supabase,isCurrent:()=>epoch===sessionEpoch&&state.page==="Agenda"});
    dialog.showModal();
   }
   if(action==="close-professional-booking")dialog?.close();
   return;
  }
  if(state.page==="Serviços"&&canManageServices()){
   if(action==="new-professional-service"){state.serviceEditor={};render();return;}
   if(action==="cancel-professional-service"){state.serviceEditor=null;render();return;}
   if(action==="refresh-professional-services"){await loadServiceCatalog();return;}
   const edit=event.target.closest("[data-service-edit]");
   if(edit){const row=state.serviceCatalog.find(item=>item.id===edit.dataset.serviceEdit&&item.editable);if(row){state.serviceEditor=row;render();}return;}
   const link=event.target.closest("[data-service-link]");if(link){await changeServiceLink(link);return;}
  }
  if(state.page==="Clientes"){
   if(action==="new-professional-customer"||action==="edit-professional-customer"){
    if(!customerRegistrationEnabled||state.role!=="professional"||!state.professional?.branch_id)return;
    state.customerEditor=action==="edit-professional-customer"?state.selectedCustomer:{};render();return;
   }
   if(action==="cancel-professional-customer"){state.customerEditor=null;render();return;}
   const customer=event.target.closest("[data-professional-customer]");
   if(customer){await openCustomer(customer.dataset.professionalCustomer);return;}
   if(action==="back-professional-customers"){state.selectedCustomer=null;state.customerHistory=[];render();return;}
   if(action==="refresh-professional-customers"){state.selectedCustomer=null;await loadCustomers();return;}
   if(action==="retry-professional-customer-history"&&state.selectedCustomer){await openCustomer(state.selectedCustomer.id);return;}
  }
  if(state.page==="Notificações"&&notificationsEnabled){
   if(action==="refresh-professional-notifications"){await loadNotifications();return;}
   if(action==="read-all-professional-notifications"){await readNotifications(event.target.closest("[data-action]"));return;}
   const filter=event.target.closest("[data-notification-filter]");
   if(filter){if(state.notificationsStatus==="loading")return;state.notificationsFilter=filter.dataset.notificationFilter==="unread";await loadNotifications();return;}
   const mark=event.target.closest("[data-notification-read]");
   if(mark){await readNotifications(mark,mark.dataset.notificationRead);return;}
  }
  if(action==="refresh-professional-profile"&&["Perfil","Configurações"].includes(state.page)){await loadProfilePreferences();return;}
  if(state.page==="Comissões"){
   if(action==="refresh-professional-commissions"){state.selectedPayout=null;await loadCommissions();return;}
   if(action==="reset-professional-commission-filters"){state.commissionFilters={from:"",to:"",status:"all",type:"all"};render();return;}
   if(action==="back-professional-payout"){state.selectedPayout=null;render();return;}
   const payout=event.target.closest("[data-professional-payout]");
   if(payout){state.selectedPayout=state.commissionPayouts.find(row=>row.id===payout.dataset.professionalPayout)||null;render();return;}
  }
  if(action==="retry-professional-order-items"&&state.page==="Comandas"&&state.selectedOrder){await chooseOrder(state.selectedOrder.id);return;}
  if(action==="refresh-professional-orders"&&state.page==="Comandas"){
   await loadOrders();
   if(state.page==="Comandas")render();
   return;
  }
  if(action==="logout"){await endSession();return;}
  if(action==="retry-professional-session"){if(!recheckingSession){await boot();}return;}
  if(action==="choose-professional-context"&&state.user&&state.contextCount>1){
   try{await loadBase();}catch(error){await endSession(error instanceof ProfessionalSessionError?error.message:"Não foi possível consultar os salões.");}return;
  }
  const branchControl=event.target.closest("[data-context-branch]");
  if(branchControl&&state.user&&state.orgId&&state.branches.some(row=>row.id===branchControl.dataset.contextBranch)){
   branchControl.disabled=true;
   try{await loadBase(state.orgId,branchControl.dataset.contextBranch);}catch(error){await endSession("Não foi possível acessar esta unidade. Consulte o salão.");}return;
  }
  if(action==="choose-professional-branch"&&state.user&&state.orgId&&state.branches.length>1){
   try{await loadBase(state.orgId);}catch{await endSession("Não foi possível consultar suas unidades.");}return;
  }
  const orgControl=event.target.closest("[data-context-org]");
  if(orgControl&&state.user){orgControl.disabled=true;try{await loadBase(orgControl.dataset.contextOrg);}catch(error){await endSession("Não foi possível acessar este salão.");}return;}
  if(!state.user||!state.orgId)return;
  const attendanceControl=event.target.closest("[data-attendance-action]");
  if(attendanceControl&&state.page==="Agenda"){if(attendanceControl.dataset.attendanceAction==="order")await openAttendanceOrder();else await applyAttendance(attendanceControl);return;}
  const statusControl=event.target.closest("[data-own-appointment-status]");
  if(statusControl&&state.page==="Agenda"){await applyAppointmentStatus(statusControl);return;}
  const epoch=sessionEpoch;
  // O controlador especializado consome eventos da Agenda antes das ações gerais.
  if(await handleAgendaClick({event,state,loadAppointments,render}))return;
  if(epoch!==sessionEpoch)return;
  const page=event.target.closest("[data-page]");
 if(page){if(!allowedProfessionalPages(state).includes(page.dataset.page))return;const menuWasOpen=root.querySelector(".app-shell.is-menu-open");state.page=page.dataset.page;state.selectedOrder=null;state.selectedAppointment=null;state.selectedCustomer=null;state.customerEditor=null;state.serviceEditor=null;state.customerHistory=[];state.notice="";render();if(menuWasOpen)root.querySelector("[data-action=open-professional-menu]")?.focus();if(["Perfil","Configurações"].includes(state.page)&&profilePreferencesEnabled&&state.profilePreferencesStatus!=="ready")await loadProfilePreferences();if(state.page==="Notificações")await loadNotifications();if(state.page==="Comissões"){state.selectedPayout=null;await loadCommissions();}if(state.page==="Clientes")await loadCustomers();if(state.page==="Serviços"&&canManageServices())await loadServiceCatalog();return;}
 const order=event.target.closest("[data-order]");
 if(order&&allowedProfessionalPages(state).includes("Comandas")){await chooseOrder(order.dataset.order);return;}
 if(action==="back-orders"){state.selectedOrder=null;state.orderItems=[];render();}

 // Nome e telefone do profissional são mantidos exclusivamente pelo salão.
 if(action==="save-profile"&&state.page==="Configurações"&&state.role!=="professional"){
  const name=String(document.querySelector("#profile-name")?.value||"").trim(),phone=String(document.querySelector("#profile-phone")?.value||"").trim();
  if(!name||name.length>120){showNotice("Informe um nome válido de até 120 caracteres.");return;}
  const {error}=await supabase.from("profiles").update({full_name:name,phone}).eq("id",state.user.id);
  if(epoch!==sessionEpoch)return;
  if(error){reportError(error,{context:"App Profissional > salvar perfil"});showNotice("Não foi possível salvar o perfil. Tente novamente.");return;}
  state.profile={...state.profile,full_name:name,phone};showNotice("Perfil atualizado.");
 }
 if(action==="change-password"&&state.page==="Configurações"){
  const password=String(document.querySelector("#settings-password")?.value||"");
  const confirmation=String(document.querySelector("#settings-password-confirm")?.value||"");
  if(password.length<10||password!==confirmation){showNotice("Informe uma senha de pelo menos 10 caracteres e confirme corretamente.");return;}
  const button=event.target.closest("[data-action=change-password]");if(button.disabled)return;button.disabled=true;
  let result;try{result=await supabase.auth.updateUser({password});}finally{button.disabled=false;}
  const {error}=result;
  if(epoch!==sessionEpoch)return;
  if(error){reportError(error,{context:"App Profissional > alterar senha"});showNotice("Não foi possível alterar a senha. Confira os requisitos e tente novamente.");return;}
  showNotice("Senha atualizada.");
 }
 }catch(error){reportError(error,{context:"App Profissional > ação de tela"});}
});
/** Salva a remarcação e mantém o calendário consistente com o horário retornado. */
async function applyAppointmentReschedule(form) {
 const appointment=state.selectedAppointment;
 if(!rescheduleEnabled||!appointment?.branch_id||appointmentStatusPending||!appointmentStatusActions(appointment))return;
 const localStart=new FormData(form).get("local_start");
 const button=form.querySelector("button[type=submit]");
 const epoch=sessionEpoch;
 appointmentStatusPending=true;
 button.disabled=true;
 try {
  const saved=await rescheduleOwnAppointment({client:supabase,organizationId:state.orgId,appointment,localStart});
  if(epoch!==sessionEpoch)return;
  const newDate=salonCalendarDate(saved.starts_at,state.organization?.timezone);
  if(state.page==="Agenda"&&state.selectedAppointment?.id===saved.id) {
   state.selectedDate=newDate;
   state.month=new Date(newDate.getFullYear(),newDate.getMonth(),1);
   state.selectedAppointment={...appointment,...saved};
  }
  state.appointments=state.appointments.filter(item=>item.id!==saved.id);
  try {
   await loadAppointments();
   if(epoch===sessionEpoch)showNotice("Agendamento reagendado.");
  } catch {
   if(epoch===sessionEpoch)showNotice("Agendamento reagendado. Atualize a Agenda para recarregar os horários.");
  }
 } catch(error) {
  if(epoch===sessionEpoch)showNotice(error.message);
 } finally {
  appointmentStatusPending=false;
  if(button.isConnected)button.disabled=false;
 }
}

/** Salva o novo horário e recarrega a agenda do mês em que ele foi criado. */
async function applyNewAppointment(form) {
 if(!bookingEnabled||state.role!=="professional"||state.page!=="Agenda"||appointmentStatusPending)return;
 const reference=form.querySelector("[data-booking-client]").dataset.selectedId;
 const service=form.querySelector("[data-booking-service]").dataset.selectedId;
 const hour=new FormData(form).get("start");
 const feedback=form.querySelector("[data-booking-error]");
 if(!reference||!service||!/^\d{2}:\d{2}$/.test(hour||"")){
  feedback.textContent=!reference?"Toque no nome da cliente na lista de sugestões.":!service?"Toque no serviço na lista de sugestões.":"Informe a hora do atendimento.";
  feedback.hidden=false;
  return;
 }
 feedback.hidden=true;
 const epoch=sessionEpoch,button=form.querySelector("button[type=submit]");
 const localStart=dateKey(state.selectedDate)+"T"+hour;
 appointmentStatusPending=true;
 button.disabled=true;
 try {
  const unitBooking=unitBookingEnabled&&customerRegistrationEnabled&&!!state.professional?.branch_id&&form.dataset.unitBooking==="true";
  const options={client:supabase,organizationId:state.orgId,reference,service,localStart};
  const saved=await (unitBooking?createUnitAppointment({...options,customerId:reference}):createOwnAppointment(options));
  if(epoch!==sessionEpoch)return;
  if(state.page==="Agenda") {
   const date=salonCalendarDate(saved.starts_at,state.organization?.timezone);
   state.selectedDate=date;
   state.month=new Date(date.getFullYear(),date.getMonth(),1);
   state.selectedAppointment=null;
  }
  try {
   await loadAppointments();
   if(epoch===sessionEpoch)showNotice("Agendamento criado.");
  } catch {
   if(epoch===sessionEpoch)showNotice("Agendamento criado. Atualize a Agenda para ver o horário.");
  }
 } catch(error) {
  if(epoch===sessionEpoch&&form.isConnected){
   feedback.textContent=error.message;
   feedback.hidden=false;
  }
 } finally {
  appointmentStatusPending=false;
  if(button.isConnected)button.disabled=false;
 }
}

root.addEventListener("submit",async event=>{
 if(event.target.matches("#professional-profile-preferences")){event.preventDefault();await submitProfilePreferences(event.target);return;}
 if(event.target.matches("#professional-commission-filter")){
  event.preventDefault();
  if(state.page!=="Comissões")return;
  const values=new FormData(event.target),from=String(values.get("from")||""),to=String(values.get("to")||"");
  const error=event.target.querySelector("[data-commission-filter-error]");
  if(from&&to&&from>to){error.textContent="A data inicial deve ser anterior ou igual à final.";error.hidden=false;return;}
  state.commissionFilters={from,to,status:String(values.get("status")||"all"),type:String(values.get("type")||"all")};render();return;
 }
 if(event.target.matches("#professional-service-form")){event.preventDefault();await submitProfessionalService(event.target);return;}
 if(event.target.matches("#professional-customer-form")){
  event.preventDefault();await submitProfessionalCustomer(event.target);return;
 }
 if(event.target.matches("#professional-new-appointment")){
  event.preventDefault();
  await applyNewAppointment(event.target);
  return;
 }
 if(event.target.matches("#professional-reschedule")){
  event.preventDefault();
  await applyAppointmentReschedule(event.target);
  return;
 }
 try{
 if(event.target.matches("#professional-password-change")){
  event.preventDefault();const values=new FormData(event.target),password=String(values.get("password")||""),confirm=String(values.get("confirm")||"");
  if(password.length<10||password!==confirm){state.notice="As senhas devem ser iguais e ter pelo menos 10 caracteres.";changePasswordView();return;}
  const button=event.target.querySelector("button[type=submit]");button.disabled=true;button.textContent="Salvando…";
  if(state.user?.app_metadata?.professional_password_required===true){
   try{
    await completeProfessionalPasswordChange({client:supabase,currentPassword:String(values.get("currentPassword")||""),password,confirm});
    await endSession("Senha atualizada. Entre novamente com a nova senha.");
   }catch(error){state.notice=error.message;changePasswordView();}
   finally{button.disabled=false;}
   return;
  }
  const {error}=await supabase.auth.updateUser({password});
  if(error){reportError(error,{context:"App Profissional > troca obrigatória de senha"});state.notice="Não foi possível alterar a senha. Confira os requisitos e tente novamente.";changePasswordView();return;}
  const {error:metaError}=await supabase.auth.updateUser({data:{must_change_password:false}});
  if(metaError){reportError(metaError,{context:"App Profissional > concluir troca obrigatória de senha"});state.notice="Senha alterada, mas não foi possível concluir a atualização do acesso. Entre novamente.";changePasswordView();return;}
  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError||!userData.user){if(userError)reportError(userError,{context:"App Profissional > confirmar sessão após troca de senha"});state.notice="Entre novamente para continuar.";await supabase.auth.signOut();loginView();return;}
  state.user=userData.user;await loadBase();return;
 }
 if(!event.target.matches("#professional-login")||endingSession)return;
 event.preventDefault();const values=new FormData(event.target),login=String(values.get("login")||"").trim(),password=String(values.get("password")||"");
 const button=event.target.querySelector("button[type=submit]");button.disabled=true;button.textContent="Validando…";
 try{
  const user=await authenticateProfessional({client:supabase,login,password});
  state.user=user;state.notice="";
  if(requiresProfessionalPasswordChange(state.user)){changePasswordView();return;}
  await loadBase();
 }catch(error){
  const message=error instanceof ProfessionalSessionError?error.message:"Não foi possível entrar. Confira suas credenciais e permissões.";
  if(state.user)await endSession(message);else{state.notice=message;loginView();}
 }
 finally{if(button){button.disabled=false;button.textContent="Entrar";}}
 }catch(error){reportError(error,{context:"App Profissional > envio de formulário"});}
});
/** Oculta dados quando não é possível verificar a conta; permite retomar sessão válida. */
function sessionRetryView(message){
 clearPrivateState();
 root.innerHTML='<main class="auth-shell professional-auth"><section class="auth-panel"><h1>Verificar acesso</h1><p role="alert">'+esc(message)+'</p><button class="primary" data-action="retry-professional-session">Tentar novamente</button><button class="secondary" data-action="logout">Sair</button></section></main>';
}
/** Revalida ao retornar ao app, preservando a página quando as permissões não mudaram. */
async function recheckSession(){
 if(!state.user||!state.orgId||recheckingSession||endingSession)return;
 const epoch=sessionEpoch,previous={orgId:state.orgId,role:state.role,scope:state.scope,professional:state.professional};
 recheckingSession=true;
 try{
  const user=await verifyProfessionalSession(supabase);
  if(epoch!==sessionEpoch)return;
  if(user.id!==state.user.id){await endSession("A conta foi alterada. Entre novamente.");return;}
  if(requiresProfessionalPasswordChange(user)){clearPrivateState();state.user=user;changePasswordView();return;}
  const contexts=await fetchProfessionalContexts(supabase,user.id);
  if(epoch!==sessionEpoch)return;
  const next=contexts.find(context=>context.orgId===previous.orgId);
  if(!next){await endSession("Seu acesso ao salão foi alterado. Entre novamente.");return;}
  if(!sameProfessionalScope(previous,next)){state.user=user;await loadBase(previous.orgId);return;}
  if(state.role==="professional"){
   const branches=await fetchProfessionalBranches({client:supabase,organizationId:previous.orgId,professional:next.professional});
   if(epoch!==sessionEpoch)return;
   if(!branches.some(row=>row.id===state.branchId)){await loadBase(previous.orgId);return;}
   state.branches=branches;
  }
  state.user=user;state.contextCount=contexts.length;
 }catch(error){
  if(epoch!==sessionEpoch)return;
  if(error instanceof ProfessionalSessionError&&["EXPIRED","DISABLED","NO_CONTEXT"].includes(error.code))await endSession(error.message);
  else sessionRetryView("Não foi possível verificar seu acesso. Confira a conexão e tente novamente.");
 }finally{recheckingSession=false;}
}
/** Inicializa sessão persistida sem confundir falhas de rede com credenciais inválidas. */
async function boot(){
 if(recheckingSession||endingSession)return;
 recheckingSession=true;const epoch=sessionEpoch;
 try{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{});
  const user=await verifyProfessionalSession(supabase);
  if(epoch!==sessionEpoch)return;
  state.user=user;
  if(requiresProfessionalPasswordChange(user)){changePasswordView();return;}
  await loadBase();
 }catch(error){
  if(error instanceof ProfessionalSessionError&&error.code==="EXPIRED"){clearPrivateState();state.notice="";loginView();}
  else if(error instanceof ProfessionalSessionError&&["DISABLED","NO_CONTEXT"].includes(error.code))await endSession(error.message);
  else sessionRetryView("Não foi possível recuperar seu acesso. Confira a conexão e tente novamente.");
 }finally{recheckingSession=false;}
}
// Eventos de sessão não chamam Auth dentro do callback, evitando bloqueio do SDK.
supabase.auth.onAuthStateChange(event=>{
 if(event==="SIGNED_OUT"&&!endingSession){clearPrivateState();state.notice="Sua sessão terminou. Entre novamente.";loginView();}
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void recheckSession();});
boot();
