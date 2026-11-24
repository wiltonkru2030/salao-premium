/** App Profissional (PWA): autenticação, sessão individual, Agenda, Comandas, Comissões e configurações do próprio perfil. */
import { createPlatformAppearance } from "../src/components/platform-appearance.js";
import { renderPlatformMark } from "../src/components/platform-mark.js";
import {authenticateProfessional} from "./auth.service.js";
import { supabase } from "./supabase.client.js";
import {bindOrderService} from "./order-service.controller.js";
import { installGlobalErrorHandlers, reportError } from "../src/utils/errors.js";
import { installGlobalMasks } from "../src/utils/input-masks.js";
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
import {ordersView,commissionsView,settingsView} from "./views/workspace.views.js";
import { renderAgendaView } from "./views/agenda.views.js";
import { handleAgendaClick } from "./agenda.controller.js";
import { fetchProfessionalAppointments } from "./appointments.service.js";
import {fetchProfessionalServices} from "./services.service.js";
import { fetchProfessionalOrders, fetchProfessionalOrderItems } from "./orders.service.js";
import { fetchProfessionalCommissions } from "./commissions.service.js";
import { resolveProfessionalContexts, allowedProfessionalPages, canRegisterProfessionalService, summarizeProfessionalCommissions } from "./access.rules.js";

// Aplicação PWA do profissional: autenticação, navegação, Agenda, Comandas e Comissões.
installGlobalErrorHandlers();
installGlobalMasks();

const appearance = createPlatformAppearance("salao-premium:professional-appearance");
const root=document.querySelector("#professional-app");
const state={
 user:null,orgId:null,role:null,scope:"none",professional:null,profile:null,organization:null,
 page:"Agenda",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),
 selectedDate:new Date(),selectedAppointment:null,appointments:[],orders:[],services:[],
 commissions:[],commissionPayouts:[],selectedOrder:null,orderItems:[],notice:""
};
let disposeAutocomplete=null;
let sessionEpoch=0;
const serviceLock={active:false,operation:null};
/** Limpa dados privados antes de exibir a tela de acesso. */
function clearPrivateState(){sessionEpoch++;serviceLock.active=false;serviceLock.operation=null;clearAutocomplete();Object.assign(state,{user:null,orgId:null,role:null,scope:"none",professional:null,profile:null,organization:null,page:"Agenda",appointments:[],orders:[],services:[],commissions:[],commissionPayouts:[],selectedAppointment:null,selectedOrder:null,orderItems:[]});}
async function endSession(notice=""){clearPrivateState();state.notice=notice;loginView();try{const {error}=await supabase.auth.signOut({scope:"local"});if(error)throw error;}catch(error){reportError(error,{context:"App Profissional > encerrar sessão"});}}

// Formatadores puros são mantidos em professional/utils/formatters.js.
function showNotice(message){if(!state.user||!state.orgId)return;state.notice=message;render();}
function clearAutocomplete(){disposeAutocomplete?.();disposeAutocomplete=null;}
// Views de autenticação ficam isoladas do controlador principal do PWA.
function loginView(){
 clearAutocomplete();
 root.innerHTML=renderProfessionalLoginView(state.notice, appearance.preference);
}
function changePasswordView(){
 root.innerHTML=renderProfessionalPasswordChangeView(state.notice);
}
// Monta cabeçalho, conteúdo e navegação principal do PWA.
function shell(content){
 const links=[["Agenda","▦"],["Comandas","▤"],["Comissões","％"],["Configurações","⚙"]].filter(([label])=>allowedProfessionalPages(state).includes(label));
 const greeting=state.professional?.name||state.profile?.full_name||"Equipe";
 root.innerHTML='<div class="app-shell"><header class="top"><div><div class="brand sp-professional-brand">' + renderPlatformMark() + '<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div><h1>Olá, '+esc(greeting.split(" ")[0])+'</h1></div><button class="icon-button" data-action="logout" aria-label="Sair">↪</button></header>'+
 '<main class="content">'+(state.notice?'<div class="notice">'+esc(state.notice)+'</div>':'')+content+'</main>'+
 '<nav class="nav">'+links.map(([label,icon])=>'<button data-page="'+label+'" class="'+(state.page===label?"active":"")+'"><span>'+icon+'</span>'+label+'</button>').join("")+'</nav></div>';
}
function appointmentCard(a){
 const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
 return '<button type="button" class="appointment '+appointmentClass(a)+'" data-appointment="'+esc(a.id)+'"><strong>'+timeLabel(a.starts_at)+' · '+esc(a.customer_name)+'</strong>'+
 '<div class="meta">'+esc(a.service_name)+' · '+timeLabel(a.ends_at)+'<br>'+esc(a.customer_phone||"Telefone não informado")+' · '+money(a.price)+'<br>'+esc(a.professional_name||state.professional?.name||"Profissional")+' · '+duration+' min</div>'+
 '<span class="tag">'+esc(statusLabel(a.status))+' · Agendado por: '+esc(sourceLabel(a.booking_source))+'</span></button>';
}
function appointmentDetails(){
 const a=state.selectedAppointment;if(!a)return "";
 const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
 return '<section class="detail"><div class="section-title"><h2>Detalhes do agendamento</h2><button class="secondary" data-action="close-appointment">Fechar</button></div>'+
 '<div class="detail-row"><span>Cliente</span><b>'+esc(a.customer_name)+'</b></div>'+
 '<div class="detail-row"><span>Telefone</span><b>'+esc(a.customer_phone||"—")+'</b></div>'+
 '<div class="detail-row"><span>Serviço</span><b>'+esc(a.service_name)+'</b></div>'+
 '<div class="detail-row"><span>Profissional</span><b>'+esc(a.professional_name||state.professional?.name||"—")+'</b></div>'+
 '<div class="detail-row"><span>Data</span><b>'+new Date(a.starts_at).toLocaleDateString("pt-BR")+'</b></div>'+
 '<div class="detail-row"><span>Horário</span><b>'+timeLabel(a.starts_at)+'–'+timeLabel(a.ends_at)+'</b></div>'+
 '<div class="detail-row"><span>Duração</span><b>'+duration+' minutos</b></div>'+
 '<div class="detail-row"><span>Valor previsto</span><b>'+money(a.price)+'</b></div>'+
 '<div class="detail-row"><span>Status</span><b>'+esc(statusLabel(a.status))+'</b></div>'+
 '<div class="detail-row"><span>Origem</span><b>'+esc(sourceLabel(a.booking_source))+'</b></div>'+
 '<div class="detail-row"><span>Quem criou</span><b>'+esc(a.created_by_name||sourceLabel(a.booking_source))+'</b></div>'+
 '<div class="detail-row"><span>Observações</span><b>'+esc(a.notes||"—")+'</b></div></section>';
}
// Apresenta calendário mensal e lista de agendamentos do profissional.
// Delega a composição visual da agenda para uma view sem efeitos colaterais.
function agendaView(){
 return renderAgendaView({state,dateKey,monthLabel,dateLabel,appointmentCard,appointmentDetails});
}
function render(){
 if(!state.user||!state.orgId)return;
 if(!allowedProfessionalPages(state).includes(state.page))state.page="Agenda";
 clearAutocomplete();
 const content=state.page==="Agenda"?agendaView():state.page==="Comandas"?ordersView(state):state.page==="Comissões"?commissionsView(state):settingsView(state, appearance.preference);
 shell(content);
 if(state.page==="Comandas"&&state.selectedOrder&&state.role==="professional"&&state.professional)bindAutocomplete();
}
// Resolve vínculo, escopo e permissões antes de liberar os módulos.
async function loadBase(selectedOrgId=null){
 const epoch=++sessionEpoch,userId=state.user?.id;
 if(!userId)throw new Error("Sua sessão expirou.");
 const [members,profiles]=await Promise.all([
  supabase.from("org_memberships").select("org_id,role,status,professional_app_enabled,professional_app_scope").eq("user_id",userId).eq("status","active"),
  supabase.from("professionals").select("id,name,profile_id,org_id,active,access_enabled").eq("profile_id",userId).eq("active",true).eq("access_enabled",true)
 ]);
 if(epoch!==sessionEpoch)return;
 if(members.error||profiles.error)throw new Error("Não foi possível consultar as permissões da conta.");
 let contexts=resolveProfessionalContexts(members.data||[],profiles.data||[]);
 if(!contexts.length)throw new Error("O acesso ao aplicativo não está habilitado para esta conta.");
 const names=await supabase.from("organizations").select("id,name,timezone,currency").in("id",contexts.map(c=>c.orgId));
 if(epoch!==sessionEpoch)return;
 if(names.error)throw new Error("Não foi possível consultar os salões vinculados.");
 const orgs=new Map((names.data||[]).map(o=>[o.id,o]));
 contexts=contexts.filter(c=>orgs.has(c.orgId));
 if(!contexts.length)throw new Error("Não foi possível identificar um salão autorizado.");
 const context=selectedOrgId?contexts.find(c=>c.orgId===selectedOrgId):contexts.length===1?contexts[0]:null;
 if(!context){
  Object.assign(state,{orgId:null,role:null,scope:"none",professional:null,organization:null,profile:null,appointments:[],orders:[],services:[],commissions:[],commissionPayouts:[],selectedAppointment:null,selectedOrder:null,orderItems:[]});
  clearAutocomplete();
  root.innerHTML='<main class="login"><div class="brand sp-professional-brand">' + renderPlatformMark() + '<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div><h1>Escolha o salão</h1><p>Seus dados ficam separados por estabelecimento.</p>'+contexts.map(c=>'<button type="button" class="primary" data-context-org="'+esc(c.orgId)+'">'+esc(orgs.get(c.orgId)?.name||"Salão")+'</button>').join("")+'<button class="secondary" data-action="logout">Sair</button></main>';
  return;
 }
 Object.assign(state,context,{organization:orgs.get(context.orgId),page:"Agenda",selectedAppointment:null,selectedOrder:null,orderItems:[],appointments:[],orders:[],services:[],commissions:[],commissionPayouts:[]});
 const profileResult=await supabase.from("profiles").select("full_name,phone").eq("id",userId).maybeSingle();
 if(epoch!==sessionEpoch)return;
 if(profileResult.error)throw new Error("Não foi possível carregar seu perfil.");
 state.profile=profileResult.data;
 const pages=allowedProfessionalPages(state);
 await Promise.all([loadAppointments(),...(pages.includes("Comandas")?[loadOrders()]:[]),...(state.role==="professional"?[loadServices()]:[]),...(pages.includes("Comissões")?[loadCommissions()]:[])]);
 if(epoch!==sessionEpoch)return;
 state.notice="";render();
}
// Carrega somente agendamentos permitidos pelo escopo profissional.
async function loadAppointments(){
 const epoch=sessionEpoch,month=state.month;
 const appointments=await fetchProfessionalAppointments({
  client:supabase,
  organizationId:state.orgId,
  month,professionalId:state.scope==='self'?state.professional?.id:null
 });
 if(epoch===sessionEpoch&&month===state.month)state.appointments=appointments;
}
// Carrega comandas visíveis ao usuário autenticado.
async function loadOrders(){
 const epoch=sessionEpoch;
 const rows=await fetchProfessionalOrders({client:supabase,organizationId:state.orgId});
 if(epoch===sessionEpoch)state.orders=rows;
}
/** Carrega o catálogo apenas para o contexto profissional atual. */
async function loadServices(){
 const epoch=sessionEpoch;
 const rows=await fetchProfessionalServices({client:supabase,organizationId:state.orgId,professionalId:state.professional?.id});
 if(epoch===sessionEpoch)state.services=rows;
}
// Carrega comissões e pagamentos do profissional autenticado.
async function loadCommissions(){
 if(!state.professional?.id)return;
 const epoch=sessionEpoch;
 const result=await fetchProfessionalCommissions({
  client:supabase,organizationId:state.orgId,professionalId:state.professional?.id
 });
 if(epoch!==sessionEpoch)return;
 state.commissions=result.commissions;
 state.commissionPayouts=result.payouts;
}
async function loadOrderItems(){
 if(!state.selectedOrder)return;
 const epoch=sessionEpoch,orderId=state.selectedOrder.id;
 const items=await fetchProfessionalOrderItems({
  client:supabase,organizationId:state.orgId,orderId
 });
 if(epoch!==sessionEpoch||state.selectedOrder?.id!==orderId)return;
 state.orderItems=items;render();
}
async function chooseOrder(id){
 state.selectedOrder=state.orders.find(o=>o.id===id)||null;state.orderItems=[];render();await loadOrderItems();
}
/** Monta o controlador de serviços da comanda atual. */
function bindAutocomplete(){
 disposeAutocomplete?.();
 disposeAutocomplete=bindOrderService({root,state,client:supabase,getEpoch:()=>sessionEpoch,lock:serviceLock,loadOrders,chooseOrder,showNotice,reportError});
}
root.addEventListener("change", event => {
 if (event.target.matches("[data-platform-appearance]")) appearance.set(event.target.value);
});
root.addEventListener("click",async event=>{
 try{
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="logout"){await endSession();return;}
  const orgControl=event.target.closest("[data-context-org]");
  if(orgControl&&state.user){orgControl.disabled=true;try{await loadBase(orgControl.dataset.contextOrg);}catch(error){await endSession("Não foi possível acessar este salão.");}return;}
  if(!state.user||!state.orgId)return;
  const epoch=sessionEpoch;
  // O controlador especializado consome eventos da Agenda antes das ações gerais.
  if(await handleAgendaClick({event,state,loadAppointments,render}))return;
  if(epoch!==sessionEpoch)return;
  const page=event.target.closest("[data-page]");
 if(page){if(!allowedProfessionalPages(state).includes(page.dataset.page))return;state.page=page.dataset.page;state.selectedOrder=null;state.selectedAppointment=null;state.notice="";render();return;}
 const order=event.target.closest("[data-order]");
 if(order&&allowedProfessionalPages(state).includes("Comandas")){await chooseOrder(order.dataset.order);return;}
 if(action==="back-orders"){state.selectedOrder=null;state.orderItems=[];render();}

 if(action==="save-profile"&&state.page==="Configurações"){
  const name=String(document.querySelector("#profile-name")?.value||"").trim(),phone=String(document.querySelector("#profile-phone")?.value||"").trim();
  if(!name||name.length>120){showNotice("Informe um nome válido de até 120 caracteres.");return;}
  const {error}=await supabase.from("profiles").update({full_name:name,phone}).eq("id",state.user.id);
  if(epoch!==sessionEpoch)return;
  if(error){reportError(error,{context:"App Profissional > salvar perfil"});showNotice("Não foi possível salvar o perfil. Tente novamente.");return;}
  state.profile={...state.profile,full_name:name,phone};showNotice("Perfil atualizado.");
 }
 if(action==="change-password"&&state.page==="Configurações"){
  const password=String(document.querySelector("#settings-password")?.value||"");
  if(password.length<10){showNotice("A senha deve ter pelo menos 10 caracteres.");return;}
  const {error}=await supabase.auth.updateUser({password});
  if(epoch!==sessionEpoch)return;
  if(error){reportError(error,{context:"App Profissional > alterar senha"});showNotice("Não foi possível alterar a senha. Confira os requisitos e tente novamente.");return;}
  showNotice("Senha atualizada.");
 }
 }catch(error){reportError(error,{context:"App Profissional > ação de tela"});}
});
root.addEventListener("submit",async event=>{
 try{
 if(event.target.matches("#professional-password-change")){
  event.preventDefault();const values=new FormData(event.target),password=String(values.get("password")||""),confirm=String(values.get("confirm")||"");
  if(password.length<10||password!==confirm){state.notice="As senhas devem ser iguais e ter pelo menos 10 caracteres.";changePasswordView();return;}
  const button=event.target.querySelector("button[type=submit]");button.disabled=true;button.textContent="Salvando…";
  const {error}=await supabase.auth.updateUser({password});
  if(error){reportError(error,{context:"App Profissional > troca obrigatória de senha"});state.notice="Não foi possível alterar a senha. Confira os requisitos e tente novamente.";changePasswordView();return;}
  const {error:metaError}=await supabase.auth.updateUser({data:{must_change_password:false}});
  if(metaError){reportError(metaError,{context:"App Profissional > concluir troca obrigatória de senha"});state.notice="Senha alterada, mas não foi possível concluir a atualização do acesso. Entre novamente.";changePasswordView();return;}
  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError||!userData.user){if(userError)reportError(userError,{context:"App Profissional > confirmar sessão após troca de senha"});state.notice="Entre novamente para continuar.";await supabase.auth.signOut();loginView();return;}
  state.user=userData.user;await loadBase();return;
 }
 if(!event.target.matches("#professional-login"))return;
 event.preventDefault();const values=new FormData(event.target),login=String(values.get("login")||"").trim(),password=String(values.get("password")||"");
 const button=event.target.querySelector("button[type=submit]");button.disabled=true;button.textContent="Validando…";
 try{
  const user=await authenticateProfessional({client:supabase,login,password});
  state.user=user;state.notice="";
  if(state.user.user_metadata?.must_change_password){changePasswordView();return;}
  await loadBase();
 }catch(error){reportError(error,{context:"App Profissional > entrar"});await endSession("Não foi possível entrar. Confira suas credenciais e permissões.");}
 finally{if(button){button.disabled=false;button.textContent="Entrar";}}
 }catch(error){reportError(error,{context:"App Profissional > envio de formulário"});}
});
// Inicialização do PWA: sessão existente ou tela de login.
async function boot(){
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
 const {data,error}=await supabase.auth.getUser();
 if(error){reportError(error,{context:"App Profissional > recuperar sessão"});state.notice="Não foi possível recuperar sua sessão.";loginView();return;}
 if(data.user){
  state.user=data.user;
  if(state.user.user_metadata?.must_change_password){changePasswordView();return;}
  try{await loadBase();}catch(error){reportError(error,{context:"App Profissional > inicializar dados da sessão"});state.notice="Não foi possível carregar seus dados. Entre novamente ou contate o administrador.";await endSession("Não foi possível carregar seus dados. Entre novamente ou contate o administrador.");}
 }else loginView();
}
boot();
