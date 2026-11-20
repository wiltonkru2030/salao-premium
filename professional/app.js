/** App Profissional (PWA): autenticação, sessão individual, Agenda, Comandas, Comissões e configurações do próprio perfil. */
import { supabase } from "../src/supabase/client.js";
import { mountAutocomplete } from "../src/components/autocomplete.js";
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
import { renderAgendaView } from "./views/agenda.views.js";
import { handleAgendaClick } from "./agenda.controller.js";
import { fetchProfessionalAppointments } from "./appointments.service.js";
import { fetchProfessionalOrders, fetchProfessionalOrderItems } from "./orders.service.js";
import { addProfessionalServiceToOrder } from "./order-items.service.js";
import { fetchProfessionalCommissions } from "./commissions.service.js";
import { resolveProfessionalContexts, allowedProfessionalPages, canRegisterProfessionalService, summarizeProfessionalCommissions } from "./access.rules.js";

// Aplicação PWA do profissional: autenticação, navegação, Agenda, Comandas e Comissões.
installGlobalErrorHandlers();
installGlobalMasks();

const root=document.querySelector("#professional-app");
const state={
 user:null,orgId:null,role:null,scope:"none",professional:null,profile:null,organization:null,
 page:"Agenda",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),
 selectedDate:new Date(),selectedAppointment:null,appointments:[],orders:[],services:[],
 commissions:[],commissionPayouts:[],selectedOrder:null,orderItems:[],notice:""
};
let disposeAutocomplete=null;
let sessionEpoch=0;
let registeringService=false;
/** Limpa dados privados antes de exibir a tela de acesso. */
function clearPrivateState(){sessionEpoch++;clearAutocomplete();Object.assign(state,{user:null,orgId:null,role:null,scope:"none",professional:null,profile:null,organization:null,page:"Agenda",appointments:[],orders:[],services:[],commissions:[],commissionPayouts:[],selectedAppointment:null,selectedOrder:null,orderItems:[]});}
async function endSession(notice=""){clearPrivateState();state.notice=notice;loginView();try{const {error}=await supabase.auth.signOut({scope:"local"});if(error)throw error;}catch(error){reportError(error,{context:"App Profissional > encerrar sessão"});}}

// Formatadores puros são mantidos em professional/utils/formatters.js.
function showNotice(message){if(!state.user||!state.orgId)return;state.notice=message;render();}
function clearAutocomplete(){disposeAutocomplete?.();disposeAutocomplete=null;}
// Views de autenticação ficam isoladas do controlador principal do PWA.
function loginView(){
 clearAutocomplete();
 root.innerHTML=renderProfessionalLoginView(state.notice);
}
function changePasswordView(){
 root.innerHTML=renderProfessionalPasswordChangeView(state.notice);
}
// Monta cabeçalho, conteúdo e navegação principal do PWA.
function shell(content){
 const links=[["Agenda","▦"],["Comandas","▤"],["Comissões","％"],["Configurações","⚙"]].filter(([label])=>allowedProfessionalPages(state).includes(label));
 const greeting=state.professional?.name||state.profile?.full_name||"Equipe";
 root.innerHTML='<div class="app-shell"><header class="top"><div><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Olá, '+esc(greeting.split(" ")[0])+'</h1></div><button class="icon-button" data-action="logout" aria-label="Sair">↪</button></header>'+
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
// Apresenta comandas autorizadas e seus detalhes.
function ordersView(){
 if(state.selectedOrder){
  const order=state.selectedOrder,canRegister=canRegisterProfessionalService(state,order);
  const rows=state.orderItems.length?state.orderItems.map(i=>'<article class="service"><strong>'+esc(i.description)+'</strong><div class="meta">'+Number(i.quantity)+' × '+money(i.unit_price)+' · '+money(i.total)+'</div><span class="tag">'+(i.item_type==="service"?"Serviço":"Produto")+'</span></article>').join(""):'<div class="empty">Nenhum item visível nesta comanda.</div>';
  return '<button class="secondary" data-action="back-orders">← Voltar às comandas</button>'+
   '<div class="detail"><strong>Comanda #'+esc(order.order_number)+'</strong><div class="detail-row"><span>Status</span><b>'+esc(statusLabel(order.status))+'</b></div><div class="detail-row"><span>Total</span><b>'+money(order.total)+'</b></div></div>'+
   '<div class="section-title"><h2>Atendimentos e itens</h2></div>'+rows+
   (canRegister?'<section class="detail"><strong>Registrar serviço realizado</strong><label class="field service-search">Buscar serviço<input id="service-search" placeholder="Digite o nome do serviço" autocomplete="off"></label><button class="primary" id="add-service" disabled>Registrar serviço</button><p class="muted">O valor é confirmado pelo catálogo do salão. Produtos e pagamentos são geridos pela equipe autorizada.</p></section>':"");
 }
 return '<div class="section-title"><h2>Comandas</h2><span class="muted">Atendimentos vinculados ao seu acesso</span></div>'+
 (state.orders.length?state.orders.map(o=>'<button class="order" data-order="'+esc(o.id)+'"><strong>Comanda #'+esc(o.order_number)+'</strong><div class="meta">Status: '+esc(statusLabel(o.status))+' · '+money(o.total)+'</div></button>').join(""):'<div class="empty">Nenhuma comanda disponível.</div>');
}
// Apresenta valores e histórico de comissões do profissional.
function commissionsView(){
 const summary=summarizeProfessionalCommissions(state.commissions,state.commissionPayouts);
 const payoutTotal=summary.received;
 return '<div class="section-title"><h2>Comissões</h2><span class="muted">Valores, histórico e pagamentos</span></div>'+
 '<section class="detail"><div class="detail-row"><span>Créditos em aberto</span><b>'+money(summary.credit)+'</b></div><div class="detail-row"><span>Débitos por estorno</span><b>'+money(summary.debit)+'</b></div><div class="detail-row"><span>Saldo líquido</span><b>'+money(summary.open)+'</b></div></section>'+
 '<div class="section-title"><h2>Histórico de comissões</h2></div>'+
 (state.commissions.length?state.commissions.map(c=>'<article class="commission"><strong>'+money(c.amount)+'</strong><div class="meta">'+(Number(c.amount)<0?"Débito por estorno · ":"")+'Base: '+money(c.base_amount)+' · Taxa: '+Number(c.rate)+'%<br>Registro: '+dateTimeLabel(c.created_at)+(c.paid_at?' · Pagamento: '+dateTimeLabel(c.paid_at):'')+'</div><span class="tag">'+esc(statusLabel(c.status))+'</span></article>').join(""):'<div class="empty">Nenhuma comissão registrada.</div>')+
 '<div class="section-title"><h2>Pagamentos recebidos</h2><span class="muted">'+money(payoutTotal)+' em pagamentos</span></div>'+
 (state.commissionPayouts.length?state.commissionPayouts.map(p=>'<article class="commission"><strong>'+money(p.amount)+'</strong><div class="meta">'+esc(p.payment_method)+' · '+dateTimeLabel(p.paid_at)+(p.notes?' · '+esc(p.notes):'')+'</div><span class="tag success">Pago</span></article>').join(""):'<div class="empty">Nenhum pagamento de comissão registrado.</div>');
}
// Apresenta dados de perfil e segurança da conta.
function settingsView(){
 const name=state.profile?.full_name||state.professional?.name||"";
 return '<div class="section-title"><h2>Configurações</h2><span class="muted">Perfil, senha e preferências</span></div>'+
 '<section class="detail"><div class="detail-row"><span>Salão</span><b>'+esc(state.organization?.name||"Conta vinculada")+'</b></div><div class="detail-row"><span>Permissão</span><b>'+esc(state.scope==="all"?"Acesso completo":state.scope==="calendar_all"?"Agenda completa":"Somente seus dados")+'</b></div>'+
 '<label class="field">Nome<input id="profile-name" value="'+esc(name)+'" maxlength="120"></label><label class="field">Telefone<input id="profile-phone" data-mask="phone" value="'+esc(state.profile?.phone||"")+'" inputmode="tel"></label><button class="primary" data-action="save-profile">Salvar perfil</button></section>'+
 '<section class="detail"><h3>Senha</h3><label class="field">Nova senha<input id="settings-password" type="password" minlength="10" autocomplete="new-password" placeholder="Mínimo de 10 caracteres"></label><button class="secondary" data-action="change-password">Atualizar senha</button><p class="muted">A redefinição de senha também pode ser feita pelo administrador.</p></section>'+
 '<button class="secondary" data-action="logout">Sair da conta</button>';
}
function render(){
 if(!state.user||!state.orgId)return;
 if(!allowedProfessionalPages(state).includes(state.page))state.page="Agenda";
 clearAutocomplete();
 const content=state.page==="Agenda"?agendaView():state.page==="Comandas"?ordersView():state.page==="Comissões"?commissionsView():settingsView();
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
  root.innerHTML='<main class="login"><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Escolha o salão</h1><p>Seus dados ficam separados por estabelecimento.</p>'+contexts.map(c=>'<button type="button" class="primary" data-context-org="'+esc(c.orgId)+'">'+esc(orgs.get(c.orgId)?.name||"Salão")+'</button>').join("")+'<button class="secondary" data-action="logout">Sair</button></main>';
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
async function loadServices(){
 const epoch=sessionEpoch;
 let query=supabase.from("services").select("id,name,category,duration_minutes,price").eq("org_id",state.orgId).eq("active",true).order("name").limit(250);
 if(state.professional){
  const {data:links,error:linkError}=await supabase.from("professional_services").select("service_id").eq("org_id",state.orgId).eq("professional_id",state.professional.id);
  if(epoch!==sessionEpoch)return;
  if(linkError)throw linkError;
  const ids=[...new Set((links||[]).map(row=>row.service_id))];
  if(!ids.length){state.services=[];return;}
  query=query.in("id",ids);
 }
 const {data,error}=await query;
 if(epoch!==sessionEpoch)return;
 if(error)throw error;state.services=data||[];
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
function bindAutocomplete(){
 const input=document.querySelector("#service-search"),button=document.querySelector("#add-service");if(!input||!button)return;
 disposeAutocomplete?.();
 let selected=null;
 disposeAutocomplete=mountAutocomplete(input,{
  search:async term=>state.services.filter(s=>s.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
  getLabel:item=>item.name+" · "+money(item.price),
  onSelect:item=>{selected=item;button.disabled=!item;}
 });
 button.addEventListener("click",async()=>{
  if(registeringService||!selected||!state.user||!canRegisterProfessionalService(state,state.selectedOrder))return;
  registeringService=true;
  const epoch=sessionEpoch;
  const orderId=state.selectedOrder.id;
  const service=selected;
  button.disabled=true;button.textContent="Registrando…";
  try{
   await addProfessionalServiceToOrder({
    client:supabase,organizationId:state.orgId,orderId,service,
    professionalId:state.professional.id,userId:state.user.id
   });
   if(epoch!==sessionEpoch)return;
   await loadOrders();if(epoch!==sessionEpoch)return;
   if(state.page==="Comandas"&&state.selectedOrder?.id===orderId)await chooseOrder(orderId);
   showNotice("Serviço registrado na comanda.");
  }catch(error){
   reportError(error,{context:"App Profissional > registrar serviço realizado"});
   showNotice(error?.message||"Não foi possível registrar o serviço. Tente novamente.");
  }finally{
   // Garante que o botão não permaneça travado após falhas de gravação ou atualização.
   registeringService=false;
   button.disabled=!selected;
   button.textContent="Registrar serviço";
  }
 });
}
root.addEventListener("click",async event=>{
 try{
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="logout"){await endSession();return;}
  const orgControl=event.target.closest("[data-context-org]");
  if(orgControl&&state.user){orgControl.disabled=true;try{await loadBase(orgControl.dataset.contextOrg);}catch(error){await endSession("Não foi possível acessar este salão.");}return;}
  if(!state.user||!state.orgId)return;
  // O controlador especializado consome eventos da Agenda antes das ações gerais.
  if(await handleAgendaClick({event,state,loadAppointments,render}))return;
  const page=event.target.closest("[data-page]");
 if(page){if(!allowedProfessionalPages(state).includes(page.dataset.page))return;state.page=page.dataset.page;state.selectedOrder=null;state.selectedAppointment=null;state.notice="";render();return;}
 const order=event.target.closest("[data-order]");
 if(order&&allowedProfessionalPages(state).includes("Comandas")){await chooseOrder(order.dataset.order);return;}
 if(action==="back-orders"){state.selectedOrder=null;state.orderItems=[];render();}

 if(action==="save-profile"){
  const name=String(document.querySelector("#profile-name")?.value||"").trim(),phone=String(document.querySelector("#profile-phone")?.value||"").trim();
  if(!name){showNotice("Informe seu nome.");return;}
  const {error}=await supabase.from("profiles").update({full_name:name,phone}).eq("id",state.user.id);
  if(error){reportError(error,{context:"App Profissional > salvar perfil"});showNotice("Não foi possível salvar o perfil. Tente novamente.");return;}
  state.profile={...state.profile,full_name:name,phone};showNotice("Perfil atualizado.");
 }
 if(action==="change-password"){
  const password=String(document.querySelector("#settings-password")?.value||"");
  if(password.length<10){showNotice("A senha deve ter pelo menos 10 caracteres.");return;}
  const {error}=await supabase.auth.updateUser({password});
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
  if(login.includes("@")){
   const {error}=await supabase.auth.signInWithPassword({email:login.toLowerCase(),password});
   if(error)throw new Error("E-mail ou senha inválidos.");
  }else{
   const {data,error}=await supabase.functions.invoke("professional-cpf-login",{body:{cpf:login,password}});
   if(error||!data?.access_token||!data?.refresh_token)throw new Error(data?.error||"CPF ou senha inválidos.");
   const {error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
  }
  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError||!userData.user)throw new Error("Não foi possível iniciar sua sessão.");
  state.user=userData.user;state.notice="";
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
