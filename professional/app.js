/** App Profissional (PWA): autenticação, sessão individual, Agenda, Comandas, Comissões e configurações do próprio perfil. */
import {createProfessionalState,resetProfessionalState} from "./workspace-state.js";
import {createProfessionalPush} from "./push.service.js";
import {canUseSelectedUnit} from "./unit-context.js";
import {createCustomersController} from "./controllers/customers.controller.js";
import {createServicesController} from "./controllers/services.controller.js";
import {createNotificationsController} from "./controllers/notifications.controller.js";
import {createWorkingHoursController} from "./controllers/working-hours.controller.js";
import {createProfileController} from "./controllers/profile.controller.js";
import {createFinancialController} from "./controllers/financial.controller.js";
import {salonTimezone} from "./utils/salon-time.js";
import { createPlatformAppearance } from "../src/components/platform-appearance.js";
import {syncProfessionalHeader,toggleProfessionalTheme} from "./utils/header-preferences.js";
import {renderProfessionalShell, setProfessionalMenuOpen} from "./views/shell.views.js";
import {createSessionController} from "./controllers/session.controller.js";
import {createNavigationController} from "./controllers/navigation.controller.js";
import { supabase } from "./supabase.client.js";
import {bindOrderService} from "./order-service.controller.js";
import {bindOrderManagement} from "./order-management.controller.js";
import {renderNotificationsView} from "./views/notifications.views.js";
import { installGlobalErrorHandlers, reportError } from "../src/utils/errors.js";
import { installGlobalMasks, formatCpf } from "../src/utils/input-masks.js";
import {escapeHtml as esc} from "./utils/formatters.js";
import {matchesSearch,matchesPhone} from "./utils/search.js";
import {updatePixField} from "./utils/pix-fields.js";
import { renderProfessionalPasswordChangeView, renderProfessionalLoginView } from "./views/auth.views.js";
import {ordersView,commissionsView,profileView,settingsView} from "./views/workspace.views.js";
import { renderProfessionalCustomers } from "./views/customers.views.js";
import { renderProfessionalServices } from "./views/services.views.js";
import {bindProfessionalBookingSearch} from "./booking-search.js";
import {createAttendanceController} from "./controllers/attendance.controller.js";
import {createAgendaWorkspaceViews} from "./views/agenda-workspace.views.js";
import {syncAppointmentDialog} from "./appointment-dialog.js";
import { handleAgendaClick } from "./agenda.controller.js";
import {fetchProfessionalAppointments} from "./appointments.service.js";
import {allowedProfessionalPages} from "./access.rules.js";

// Aplicação PWA do profissional: autenticação, navegação, Agenda, Comandas e Comissões.
installGlobalErrorHandlers();
installGlobalMasks();

const appearance = createPlatformAppearance("salao-premium:professional-appearance");
const root=document.querySelector("#professional-app");
const state=createProfessionalState();
// Atualiza a saudação sem rerenderizar formulários.
const refreshHeader=()=>syncProfessionalHeader(root,state);
setInterval(refreshHeader,60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshHeader();});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",refreshHeader);
let disposeAutocomplete=null;
let sessionEpoch=0;
// Ative a interface no build após instalar a migration correspondente no Supabase.
const appointmentStatusEnabled = import.meta.env.VITE_PROFESSIONAL_APPOINTMENT_STATUS === "true";
// Ative após aplicar a migration de reagendamento no ambiente correspondente.
const bookingEnabled = import.meta.env.VITE_PROFESSIONAL_BOOKING === "true";
const customerRegistrationEnabled = import.meta.env.VITE_PROFESSIONAL_CUSTOMER_REGISTRATION === "true";
const notificationsEnabled = import.meta.env.VITE_PROFESSIONAL_NOTIFICATIONS === "true";
const profilePreferencesEnabled = import.meta.env.VITE_PROFESSIONAL_PROFILE_PREFERENCES === "true";
const orderManagementEnabled = import.meta.env.VITE_PROFESSIONAL_ORDER_MANAGEMENT === "true";
const attendanceEnabled = import.meta.env.VITE_PROFESSIONAL_ATTENDANCE === "true";
const serviceManagementEnabled = import.meta.env.VITE_PROFESSIONAL_SERVICE_MANAGEMENT === "true";
const unitBookingEnabled = import.meta.env.VITE_PROFESSIONAL_UNIT_BOOKING === "true";
const explicitBranchEnabled = import.meta.env.VITE_PROFESSIONAL_EXPLICIT_BRANCH === "true";
const rescheduleEnabled = import.meta.env.VITE_PROFESSIONAL_RESCHEDULE === "true";
const workingHoursEnabled=import.meta.env.VITE_PROFESSIONAL_WORKING_HOURS==="true";
const hours=createWorkingHoursController({state,client:supabase,getEpoch:()=>sessionEpoch,render,showNotice,enabled:workingHoursEnabled});
const serviceLock={active:false,operation:null};
const {agendaView,appointmentStatusActions}=createAgendaWorkspaceViews({state,attendanceEnabled,appointmentStatusEnabled,rescheduleEnabled,bookingEnabled,unitBookingEnabled,customerRegistrationEnabled,workingHoursEnabled});
// Controladores recebem a geração da sessão por função, nunca como valor congelado.
const {loadCustomers,openCustomer,submitProfessionalCustomer}=createCustomersController({state,supabase,getEpoch:()=>sessionEpoch,render,reportError,customerRegistrationEnabled});
const {loadServices,canManageServices,loadServiceCatalog,changeServiceLink,submitProfessionalService}=createServicesController({state,supabase,getEpoch:()=>sessionEpoch,render,reportError,showNotice,serviceManagementEnabled});
const {loadNotifications,readNotifications}=createNotificationsController({state,supabase,getEpoch:()=>sessionEpoch,render,showNotice,notificationsEnabled,updateUnread:count=>{
 const badge=root.querySelector("[data-professional-unread-count]");if(badge){badge.hidden=count===0;badge.textContent=count>99?"99+":String(count);}
}});
const {loadProfilePreferences,submitProfilePreferences}=createProfileController({state,supabase,getEpoch:()=>sessionEpoch,render,showNotice,profilePreferencesEnabled});
const {loadOrders,loadCommissions,chooseOrder}=createFinancialController({state,supabase,getEpoch:()=>sessionEpoch,render,reportError});
const {applyAppointmentStatus,applyAttendance,openAttendanceOrder,applyAppointmentReschedule,applyNewAppointment}=createAttendanceController({state,supabase,getEpoch:()=>sessionEpoch,showNotice,loadAppointments,loadOrders,chooseOrder,appointmentStatusActions,appointmentStatusEnabled,attendanceEnabled,rescheduleEnabled,bookingEnabled,unitBookingEnabled,customerRegistrationEnabled});
const push=createProfessionalPush({client:supabase,onMessage:()=>{if(state.user&&state.orgId)void loadNotifications();}});
const session=createSessionController({state,root,supabase,getEpoch:()=>sessionEpoch,clearPrivateState,clearAutocomplete,loginView,changePasswordView,render,reportError,loadAppointments,loadNotifications,notificationsEnabled,explicitBranchEnabled,beforeExit:orgId=>push.configured?push.disable(orgId):Promise.resolve()});
const {switchContext,endSession,boot}=session;
const {navigate,refreshOrders}=createNavigationController({state,root,getEpoch:()=>sessionEpoch,render,showNotice,loadOrders,loadServices,loadServiceCatalog,canManageServices,loadCustomers,loadCommissions,loadNotifications,loadProfilePreferences,profilePreferencesEnabled});


/** Limpa dados privados antes de exibir a tela de acesso. */
function clearPrivateState(){sessionEpoch++;serviceLock.active=false;serviceLock.operation=null;clearAutocomplete();resetProfessionalState(state);}
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
 syncProfessionalHeader(root,state);
}

function render(){
 if(!state.user||!state.orgId||(state.role==="professional"&&!state.branchId))return;
 if(!allowedProfessionalPages(state).includes(state.page))state.page="Agenda";
 clearAutocomplete();
 const content=state.page==="Agenda"?agendaView():state.page==="Comandas"?ordersView(state,{managementEnabled:orderManagementEnabled}):state.page==="Comissões"?commissionsView(state):state.page==="Serviços"?renderProfessionalServices(state.services,{manage:canManageServices(),catalog:state.serviceCatalog,editor:state.serviceEditor,status:state.serviceCatalogStatus}):state.page==="Clientes"?renderProfessionalCustomers({...state,canManageCustomers:customerRegistrationEnabled&&canUseSelectedUnit(state)}):state.page==="Notificações"?renderNotificationsView(state):state.page==="Perfil"?profileView(state,{preferencesEnabled:profilePreferencesEnabled}):settingsView(state, appearance.preference,{preferencesEnabled:profilePreferencesEnabled,pushConfigured:push.configured,workingHoursEnabled});
 shell(content);
 if(state.page==="Agenda")syncAppointmentDialog(root,state,render);
 if(state.page==="Comandas"&&state.selectedOrder&&state.role==="professional"&&state.professional)bindAutocomplete();
}
// Carrega somente agendamentos permitidos pelo escopo profissional.
async function loadAppointments(){
 const epoch=sessionEpoch,month=state.month;
 state.agendaStatus="loading";state.appointments=[];
 if(state.page==="Agenda")render();
 try{
  const appointments=await fetchProfessionalAppointments({
   client:supabase,organizationId:state.orgId,month,branchId:state.branchId,
   timezone:salonTimezone(state.organization?.timezone),professionalId:state.scope==='self'?state.professional?.id:null
  });
  if(epoch===sessionEpoch&&month===state.month){
   state.appointments=appointments;state.agendaStatus="ready";
   if(state.selectedAppointment)state.selectedAppointment=appointments.find(row=>row.id===state.selectedAppointment.id)||null;
  }
 }catch(error){
  if(epoch!==sessionEpoch||month!==state.month)return;
  state.agendaStatus="error";state.selectedAppointment=null;reportError(error,{context:"App Profissional > Agenda"});
  // O erro aparece na Agenda sem encerrar uma sessão válida.
 }
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
 if(event.target.matches("#professional-login [name=login]")&&!event.isComposing&&/^[0-9.\s-]+$/.test(event.target.value)){event.target.value=formatCpf(event.target.value);return;}
 const control=event.target.closest("[data-professional-list-search]");
 if(!control)return;
 const term=control.value.trim(),list=control.closest("[data-professional-list]");
 if(!list)return;
 let visible=0;
 for(const item of list.querySelectorAll("[data-professional-search-text]")){
  item.hidden=!matchesSearch(item.dataset.professionalSearchText,term)&&!matchesPhone(item.dataset.professionalPhone,term);
  if(!item.hidden)visible++;
 }
 const empty=list.querySelector("[data-professional-search-empty]");if(empty)empty.hidden=visible>0||!term;
});
root.addEventListener("change", event => {
 if (event.target.matches("[data-platform-appearance]")) {appearance.set(event.target.value);syncProfessionalHeader(root,state);}
 if(event.target.matches("#professional-profile-preferences [name=pixType]"))updatePixField(event.target.form);
});
/** Persiste a mudança e atualiza o cartão apenas se a sessão ainda for a mesma. */
root.addEventListener("click",async event=>{
 try{
  const action=event.target.closest("[data-action]")?.dataset.action;
   if(action==="toggle-professional-theme"){toggleProfessionalTheme(root,state,appearance);return;}
  if(action==="open-professional-menu"||action==="close-professional-menu"){
   setProfessionalMenuOpen(root,action==="open-professional-menu");
   return;
  }
  if(action==="load-own-hours"){await hours.load();return;}
  const removeHours=event.target.closest("[data-remove-own-hours]");if(removeHours){await hours.save(removeHours.closest("form"),true);return;}
  if(action==="open-professional-booking"||action==="close-professional-booking"){
   const dialog=root.querySelector("#professional-booking-dialog");
   if(action==="open-professional-booking"&&dialog&&!dialog.open){
    const epoch=sessionEpoch,control=event.target.closest("[data-action]");
    if(control.disabled)return;control.disabled=true;
    try{await loadServices();}catch{if(epoch===sessionEpoch)showNotice("Não foi possível carregar os serviços. Tente novamente.");return;}finally{if(control.isConnected)control.disabled=false;}
    if(epoch!==sessionEpoch||state.page!=="Agenda"||!dialog.isConnected)return;
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
    if(!customerRegistrationEnabled||!canUseSelectedUnit(state))return;
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
  if((action==="enable-professional-push"||action==="disable-professional-push")&&state.page==="Configurações"&&state.role==="professional"&&push.configured){
   const control=event.target.closest("[data-action]");if(control.disabled||state.pushStatus==="loading")return;
   const epoch=sessionEpoch,orgId=state.orgId;control.disabled=true;state.pushStatus="loading";
   try{const enabled=action==="enable-professional-push"?await push.enable(orgId,()=>epoch===sessionEpoch):await push.disable(orgId);if(epoch!==sessionEpoch)return;state.pushStatus=enabled?"enabled":"disabled";showNotice(enabled?"Notificações ativadas neste dispositivo.":"Notificações desativadas neste dispositivo.");}
   catch(error){if(epoch===sessionEpoch){state.pushStatus="error";showNotice(error.message);}}finally{if(control.isConnected)control.disabled=false;}return;
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
   await refreshOrders();
   return;
  }
  if(action==="logout"){await endSession();return;}
  if(action==="retry-professional-session"){await boot();return;}
  if(action==="choose-professional-context"&&state.user&&state.contextCount>1){
   await switchContext();return;
  }
  const branchControl=event.target.closest("[data-context-branch]");
  if(branchControl&&state.user&&state.orgId&&state.branches.some(row=>row.id===branchControl.dataset.contextBranch)){
   branchControl.disabled=true;
   await switchContext(state.orgId,branchControl.dataset.contextBranch);return;
  }
  if(action==="choose-professional-branch"&&state.user&&state.orgId&&state.branches.length>1){
   await switchContext(state.orgId);return;
  }
  const orgControl=event.target.closest("[data-context-org]");
  if(orgControl&&state.user){orgControl.disabled=true;await switchContext(orgControl.dataset.contextOrg);return;}
  if(!state.user||!state.orgId)return;
  const attendanceControl=event.target.closest("[data-attendance-action]");
  if(attendanceControl&&state.page==="Agenda"){
   if(attendanceControl.dataset.attendanceAction==="order"){
    const epoch=sessionEpoch,appointmentId=attendanceControl.dataset.appointmentId;
    if(attendanceControl.disabled)return;attendanceControl.disabled=true;
    try{await loadServices();}catch{if(epoch===sessionEpoch)showNotice("Não foi possível carregar os serviços. Tente novamente.");return;}finally{if(attendanceControl.isConnected)attendanceControl.disabled=false;}
    if(epoch===sessionEpoch&&state.page==="Agenda")await openAttendanceOrder(appointmentId);
   }else await applyAttendance(attendanceControl);return;
  }
  const statusControl=event.target.closest("[data-own-appointment-status]");
  if(statusControl&&state.page==="Agenda"){await applyAppointmentStatus(statusControl);return;}
  const epoch=sessionEpoch;
  // O controlador especializado consome eventos da Agenda antes das ações gerais.
  if(state.page==="Agenda"&&action==="retry-professional-agenda"){await loadAppointments();if(epoch===sessionEpoch)render();return;}
  if(state.page==="Agenda"&&await handleAgendaClick({event,state,loadAppointments,render:()=>{if(epoch===sessionEpoch&&state.page==="Agenda")render();}}))return;
  if(epoch!==sessionEpoch)return;
  const page=event.target.closest("[data-page]");
 if(page){await navigate(page.dataset.page);if(state.page==="Configurações")await hours.load();return;}
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
root.addEventListener("submit",async event=>{
 if(event.target.matches("[data-own-hours-form]")){event.preventDefault();await hours.save(event.target);return;}
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
 await session.submitAuth(event);
});

session.start();
