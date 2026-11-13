/** App Profissional (PWA): autenticação, sessão individual, Agenda, Comandas, Comissões e configurações do próprio perfil. */
import { supabase } from "../src/supabase/client.js";
import { mountAutocomplete } from "../src/components/autocomplete.js";
import { installGlobalErrorHandlers, reportError } from "../src/utils/errors.js";
import { installGlobalMasks } from "../src/utils/input-masks.js";

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
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const monthLabel=d=>d.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
const dateLabel=d=>d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
const timeLabel=v=>new Date(v).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
const dateTimeLabel=v=>new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const sourceLabel=v=>({customer:"Cliente",salon:"Salão",professional:"Profissional"})[v]||"Salão";
const statusLabel=v=>({scheduled:"Agendado",confirmed:"Confirmado",arrived:"Cliente chegou",in_progress:"Em atendimento",completed:"Finalizado",cancelled:"Cancelado",no_show:"Falta",open:"Aberta",awaiting_payment:"Aguardando pagamento",partially_paid:"Pagamento parcial",closed:"Finalizada"})[v]||v||"—";
function showNotice(message){state.notice=message;render();}
function clearAutocomplete(){disposeAutocomplete?.();disposeAutocomplete=null;}
// Renderiza a tela de autenticação do profissional.
function loginView(){
 clearAutocomplete();
 root.innerHTML='<main class="login">
<div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small>
</div>
<h1>Bem-vindo(a)</h1>
<p>Profissionais entram com CPF e senha. Proprietários e usuários autorizados podem usar o e-mail.</p>'+
 (state.notice?'<div class="notice">'+esc(state.notice)+'</div>':'')+
 '<form id="professional-login">
<label class="field">CPF ou e-mail<input name="login" autocomplete="username" placeholder="000.000.000-00 ou e-mail" required>
</label>
<label class="field">Senha<input name="password" type="password" autocomplete="current-password" required>
</label>
<button class="primary" type="submit">Entrar</button>
</form>
<p class="muted">A recuperação de senha é feita somente pelo administrador do salão.</p>
</main>';
}
// Renderiza a troca obrigatória de senha temporária.
function changePasswordView(){
 root.innerHTML='<main class="login">
<div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small>
</div>
<h1>Crie sua nova senha</h1>
<p>Altere a senha temporária para proteger seu acesso.</p>'+
 (state.notice?'<div class="notice">'+esc(state.notice)+'</div>':'')+
 '<form id="professional-password-change">
<label class="field">Nova senha<input name="password" type="password" minlength="10" autocomplete="new-password" required>
</label>
<label class="field">Confirmar senha<input name="confirm" type="password" minlength="10" autocomplete="new-password" required>
</label>
<button class="primary" type="submit">Salvar nova senha</button>
</form>
</main>';
}
// Monta cabeçalho, conteúdo e navegação principal do PWA.
function shell(content){
 const links=[["Agenda","▦"],["Comandas","▤"],["Comissões","％"],["Configurações","⚙"]];
 const greeting=state.professional?.name||state.profile?.full_name||"Equipe";
 root.innerHTML='<div class="app-shell">
<header class="top">
<div>
<div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small>
</div>
<h1>Olá, '+esc(greeting.split(" ")[0])+'</h1>
</div>
<button class="icon-button" data-action="logout" aria-label="Sair">↪</button>
</header>'+
 '<main class="content">'+(state.notice?'<div class="notice">'+esc(state.notice)+'</div>':'')+content+'</main>'+
 '<nav class="nav">'+links.map(([label,icon])=>'<button data-page="'+label+'" class="'+(state.page===label?"active":"")+'">
<span>'+icon+'</span>'+label+'</button>').join("")+'</nav>
</div>';
}
function appointmentClass(a){
 if(a.status==="in_progress")return "progress";
 if(a.status==="completed"||a.status==="confirmed")return "success";
 if(a.status==="cancelled"||a.status==="no_show")return "released";
 return "scheduled";
}
function appointmentCard(a){
 const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
 return '<button type="button" class="appointment '+appointmentClass(a)+'" data-appointment="'+esc(a.id)+'">
<strong>'+timeLabel(a.starts_at)+' · '+esc(a.customer_name)+'</strong>'+
 '<div class="meta">'+esc(a.service_name)+' · '+timeLabel(a.ends_at)+'<br>'+esc(a.customer_phone||"Telefone não informado")+' · '+money(a.price)+'<br>'+esc(a.professional_name||state.professional?.name||"Profissional")+' · '+duration+' min</div>'+
 '<span class="tag">'+esc(statusLabel(a.status))+' · Agendado por: '+esc(sourceLabel(a.booking_source))+'</span>
</button>';
}
function appointmentDetails(){
 const a=state.selectedAppointment;if(!a)return "";
 const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
 return '<section class="detail">
<div class="section-title">
<h2>Detalhes do agendamento</h2>
<button class="secondary" data-action="close-appointment">Fechar</button>
</div>'+
 '<div class="detail-row">
<span>Cliente</span>
<b>'+esc(a.customer_name)+'</b>
</div>'+
 '<div class="detail-row">
<span>Telefone</span>
<b>'+esc(a.customer_phone||"—")+'</b>
</div>'+
 '<div class="detail-row">
<span>Serviço</span>
<b>'+esc(a.service_name)+'</b>
</div>'+
 '<div class="detail-row">
<span>Profissional</span>
<b>'+esc(a.professional_name||state.professional?.name||"—")+'</b>
</div>'+
 '<div class="detail-row">
<span>Data</span>
<b>'+new Date(a.starts_at).toLocaleDateString("pt-BR")+'</b>
</div>'+
 '<div class="detail-row">
<span>Horário</span>
<b>'+timeLabel(a.starts_at)+'–'+timeLabel(a.ends_at)+'</b>
</div>'+
 '<div class="detail-row">
<span>Duração</span>
<b>'+duration+' minutos</b>
</div>'+
 '<div class="detail-row">
<span>Valor previsto</span>
<b>'+money(a.price)+'</b>
</div>'+
 '<div class="detail-row">
<span>Status</span>
<b>'+esc(statusLabel(a.status))+'</b>
</div>'+
 '<div class="detail-row">
<span>Origem</span>
<b>'+esc(sourceLabel(a.booking_source))+'</b>
</div>'+
 '<div class="detail-row">
<span>Quem criou</span>
<b>'+esc(a.created_by_name||sourceLabel(a.booking_source))+'</b>
</div>'+
 '<div class="detail-row">
<span>Observações</span>
<b>'+esc(a.notes||"—")+'</b>
</div>
</section>';
}
// Apresenta calendário mensal e lista de agendamentos do profissional.
function agendaView(){
 const year=state.month.getFullYear(),month=state.month.getMonth(),first=new Date(year,month,1),offset=first.getDay(),days=new Date(year,month+1,0).getDate(),prevDays=new Date(year,month,0).getDate();
 const marks=new Set(state.appointments.map(a=>dateKey(new Date(a.starts_at))));
 const cells=[];
 for(let i=0;i<42;i++){
  let d,inside=true;
  if(i<offset){d=new Date(year,month-1,prevDays-offset+i+1);inside=false;}
  else if(i>=offset+days){d=new Date(year,month+1,i-offset-days+1);inside=false;}
  else d=new Date(year,month,i-offset+1);
  const key=dateKey(d),classes=[inside?"":"outside",key===dateKey(state.selectedDate)?"selected":"",key===dateKey(new Date())?"today":""].join(" ");
  cells.push('<button class="day '+classes+'" data-date="'+key+'">'+d.getDate()+(marks.has(key)?'<i class="dot">
</i>':'')+'</button>');
 }
 const selected=state.appointments.filter(a=>dateKey(new Date(a.starts_at))===dateKey(state.selectedDate)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
 return '<div class="section-title">
<h2>Agenda mensal</h2>
<span class="muted">'+(state.scope==="calendar_all"||state.scope==="all"?"Agenda completa autorizada":"Somente sua agenda")+'</span>
</div>'+
 '<div class="calendar-head">
<button data-action="prev-month">‹</button>
<strong>'+esc(monthLabel(state.month))+'</strong>
<button data-action="next-month">›</button>
</div>'+
 '<div class="calendar">'+["D","S","T","Q","Q","S","S"].map(d=>'<div class="weekday">'+d+'</div>').join("")+cells.join("")+'</div>'+
 '<div class="section-title section-title--tight-spaced">
<h2>'+esc(dateLabel(state.selectedDate))+'</h2>
<span class="muted">'+selected.length+' agendamento(s)</span>
</div>'+
 (selected.length?selected.map(appointmentCard).join(""):'<div class="empty">Nenhum agendamento neste dia.</div>')+appointmentDetails();
}
// Apresenta comandas autorizadas e seus detalhes.
function ordersView(){
 if(state.selectedOrder){
  const order=state.selectedOrder,canRegister=state.role==="professional"&&!!state.professional&&["open","in_progress","partially_paid"].includes(order.status);
  const rows=state.orderItems.length?state.orderItems.map(i=>'<article class="service">
<strong>'+esc(i.description)+'</strong>
<div class="meta">'+Number(i.quantity)+' × '+money(i.unit_price)+' · '+money(i.total)+'</div>
<span class="tag">'+(i.item_type==="service"?"Serviço":"Produto")+'</span>
</article>').join(""):'<div class="empty">Nenhum item visível nesta comanda.</div>';
  return '<button class="secondary" data-action="back-orders">← Voltar às comandas</button>'+
   '<div class="detail">
<strong>Comanda #'+esc(order.order_number)+'</strong>
<div class="detail-row">
<span>Status</span>
<b>'+esc(statusLabel(order.status))+'</b>
</div>
<div class="detail-row">
<span>Total</span>
<b>'+money(order.total)+'</b>
</div>
</div>'+
   '<div class="section-title">
<h2>Atendimentos e itens</h2>
</div>'+rows+
   (canRegister?'<section class="detail">
<strong>Registrar serviço realizado</strong>
<label class="field service-search">Buscar serviço<input id="service-search" placeholder="Digite o nome do serviço" autocomplete="off">
</label>
<button class="primary" id="add-service" disabled>Registrar serviço</button>
<p class="muted">O valor é confirmado pelo catálogo do salão. Produtos e pagamentos são geridos pela equipe autorizada.</p>
</section>':"");
 }
 return '<div class="section-title">
<h2>Comandas</h2>
<span class="muted">Atendimentos vinculados ao seu acesso</span>
</div>'+
 (state.orders.length?state.orders.map(o=>'<button class="order" data-order="'+esc(o.id)+'">
<strong>Comanda #'+esc(o.order_number)+'</strong>
<div class="meta">Status: '+esc(statusLabel(o.status))+' · '+money(o.total)+'</div>
</button>').join(""):'<div class="empty">Nenhuma comanda disponível.</div>');
}
// Apresenta valores e histórico de comissões do profissional.
function commissionsView(){
 const total=state.commissions.reduce((sum,c)=>sum+Number(c.amount||0),0);
 const paid=state.commissions.filter(c=>c.status==="paid").reduce((sum,c)=>sum+Number(c.amount||0),0);
 const payoutTotal=state.commissionPayouts.reduce((sum,p)=>sum+Number(p.amount||0),0);
 return '<div class="section-title">
<h2>Comissões</h2>
<span class="muted">Valores, histórico e pagamentos</span>
</div>'+
 '<section class="detail">
<div class="detail-row">
<span>Total registrado</span>
<b>'+money(total)+'</b>
</div>
<div class="detail-row">
<span>Total pago</span>
<b>'+money(paid)+'</b>
</div>
<div class="detail-row">
<span>Em aberto</span>
<b>'+money(total-paid)+'</b>
</div>
</section>'+
 '<div class="section-title">
<h2>Histórico de comissões</h2>
</div>'+
 (state.commissions.length?state.commissions.map(c=>'<article class="commission">
<strong>'+money(c.amount)+'</strong>
<div class="meta">Base: '+money(c.base_amount)+' · Taxa: '+Number(c.rate)+'%<br>Registro: '+dateTimeLabel(c.created_at)+(c.paid_at?' · Pagamento: '+dateTimeLabel(c.paid_at):'')+'</div>
<span class="tag">'+esc(statusLabel(c.status))+'</span>
</article>').join(""):'<div class="empty">Nenhuma comissão registrada.</div>')+
 '<div class="section-title">
<h2>Pagamentos recebidos</h2>
<span class="muted">'+money(payoutTotal)+' em pagamentos</span>
</div>'+
 (state.commissionPayouts.length?state.commissionPayouts.map(p=>'<article class="commission">
<strong>'+money(p.amount)+'</strong>
<div class="meta">'+esc(p.payment_method)+' · '+dateTimeLabel(p.paid_at)+(p.notes?' · '+esc(p.notes):'')+'</div>
<span class="tag success">Pago</span>
</article>').join(""):'<div class="empty">Nenhum pagamento de comissão registrado.</div>');
}
// Apresenta dados de perfil e segurança da conta.
function settingsView(){
 const name=state.profile?.full_name||state.professional?.name||"";
 return '<div class="section-title">
<h2>Configurações</h2>
<span class="muted">Perfil, senha e preferências</span>
</div>'+
 '<section class="detail">
<div class="detail-row">
<span>Salão</span>
<b>'+esc(state.organization?.name||"Conta vinculada")+'</b>
</div>
<div class="detail-row">
<span>Permissão</span>
<b>'+esc(state.scope==="all"?"Acesso completo":state.scope==="calendar_all"?"Agenda completa":"Somente seus dados")+'</b>
</div>'+
 '<label class="field">Nome<input id="profile-name" value="'+esc(name)+'" maxlength="120">
</label>
<label class="field">Telefone<input id="profile-phone" data-mask="phone" value="'+esc(state.profile?.phone||"")+'" inputmode="tel">
</label>
<button class="primary" data-action="save-profile">Salvar perfil</button>
</section>'+
 '<section class="detail">
<h3>Senha</h3>
<label class="field">Nova senha<input id="settings-password" type="password" minlength="10" autocomplete="new-password" placeholder="Mínimo de 10 caracteres">
</label>
<button class="secondary" data-action="change-password">Atualizar senha</button>
<p class="muted">A redefinição de senha também pode ser feita pelo administrador.</p>
</section>'+
 '<button class="secondary" data-action="logout">Sair da conta</button>';
}
function render(){
 clearAutocomplete();
 const content=state.page==="Agenda"?agendaView():state.page==="Comandas"?ordersView():state.page==="Comissões"?commissionsView():settingsView();
 shell(content);
 if(state.page==="Comandas"&&state.selectedOrder&&state.role==="professional"&&state.professional)bindAutocomplete();
}
// Resolve vínculo, escopo e permissões antes de liberar os módulos.
async function loadBase(){
 const {data:membership,error}=await supabase.from("org_memberships").select("org_id,role,status,professional_app_enabled,professional_app_scope")
  .eq("user_id",state.user.id).eq("status","active").limit(1).maybeSingle();
 if(error||!membership)throw new Error("Esta conta não está vinculada a um salão ativo.");
 state.orgId=membership.org_id;state.role=membership.role;state.professional=null;
 const [profileResult,orgResult]=await Promise.all([
  supabase.from("profiles").select("full_name,phone").eq("id",state.user.id).maybeSingle(),
  supabase.from("organizations").select("id,name,timezone,currency").eq("id",state.orgId).maybeSingle()
 ]);
 if(profileResult.error)throw profileResult.error;if(orgResult.error)throw orgResult.error;
 state.profile=profileResult.data;state.organization=orgResult.data;
 const allowedScopes=["self","calendar_all","all"];
 if(state.role==="professional"){
  const {data:pro,error:proError}=await supabase.from("professionals").select("id,name,profile_id,org_id,active,access_enabled")
   .eq("profile_id",state.user.id).eq("org_id",state.orgId).eq("active",true).eq("access_enabled",true).maybeSingle();
  if(proError||!pro)throw new Error("Seu cadastro profissional não está ativo ou o acesso foi desabilitado.");
  state.professional=pro;state.scope="self";
 }else{
  if(membership.professional_app_enabled!==true||!allowedScopes.includes(membership.professional_app_scope)){
   throw new Error("O administrador ainda não liberou o App Profissional para esta conta.");
  }
  state.scope=membership.professional_app_scope;
  if(state.scope==="self"){
   const {data:pro,error:proError}=await supabase.from("professionals")
    .select("id,name,profile_id,org_id,active,access_enabled")
    .eq("profile_id",state.user.id).eq("org_id",state.orgId).eq("active",true).eq("access_enabled",true).maybeSingle();
   if(proError||!pro)throw new Error("O acesso individual exige um cadastro profissional vinculado e ativo.");
   state.professional=pro;
  }
 }
 await Promise.all([loadAppointments(),loadOrders(),loadServices(),loadCommissions()]);
 state.notice="";render();
}
// Carrega somente agendamentos permitidos pelo escopo profissional.
async function loadAppointments(){
 const start=new Date(state.month.getFullYear(),state.month.getMonth(),1),end=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);
 const {data,error}=await supabase.from("appointments")
  .select("id,starts_at,ends_at,customer_name,customer_phone,service_name,professional_name,status,price,booking_source,created_by_name,notes,professional_id")
  .eq("org_id",state.orgId).gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString()).order("starts_at").limit(1000);
 if(error)throw error;state.appointments=data||[];
}
// Carrega comandas visíveis ao usuário autenticado.
async function loadOrders(){
 const {data,error}=await supabase.from("service_orders").select("id,order_number,status,total,assigned_professional_id,customer_id").eq("org_id",state.orgId).order("created_at",{ascending:false}).limit(100);
 if(error)throw error;state.orders=data||[];
}
async function loadServices(){
 let query=supabase.from("services").select("id,name,category,duration_minutes,price").eq("org_id",state.orgId).eq("active",true).order("name").limit(250);
 if(state.professional){
  const {data:links,error:linkError}=await supabase.from("professional_services").select("service_id").eq("org_id",state.orgId).eq("professional_id",state.professional.id);
  if(linkError)throw linkError;
  const ids=[...new Set((links||[]).map(row=>row.service_id))];
  if(!ids.length){state.services=[];return;}
  query=query.in("id",ids);
 }
 const {data,error}=await query;
 if(error)throw error;state.services=data||[];
}
// Carrega comissões e pagamentos do profissional autenticado.
async function loadCommissions(){
 const [commissionResult,payoutResult]=await Promise.all([
  supabase.from("commissions").select("id,base_amount,rate,amount,status,paid_at,created_at,professional_id,payout_id")
   .eq("org_id",state.orgId).order("created_at",{ascending:false}).limit(250),
  supabase.from("commission_payouts").select("id,professional_id,amount,payment_method,paid_at,notes")
   .eq("org_id",state.orgId).order("paid_at",{ascending:false}).limit(250)
 ]);
 if(commissionResult.error)throw commissionResult.error;
 if(payoutResult.error)throw payoutResult.error;
 state.commissions=commissionResult.data||[];
 state.commissionPayouts=payoutResult.data||[];
}
async function loadOrderItems(){
 if(!state.selectedOrder)return;
 const {data,error}=await supabase.from("service_order_items").select("id,item_type,description,quantity,unit_price,total,professional_id,performed_at")
  .eq("org_id",state.orgId).eq("order_id",state.selectedOrder.id).order("created_at");
 if(error)throw error;state.orderItems=data||[];render();
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
  if(!selected||!state.selectedOrder||!state.professional)return;
  button.disabled=true;button.textContent="Registrando…";
  const price=Number(selected.price||0);
  const {error}=await supabase.from("service_order_items").insert({
   org_id:state.orgId,order_id:state.selectedOrder.id,item_type:"service",service_id:selected.id,
   professional_id:state.professional.id,description:selected.name,quantity:1,unit_price:price,total:price,
   performed_at:new Date().toISOString(),created_by:state.user.id
  });
  if(error){reportError(error,{context:"App Profissional > registrar serviço realizado"});button.disabled=false;button.textContent="Registrar serviço";showNotice("Não foi possível registrar o serviço. Tente novamente.");return;}
  await loadOrders();await chooseOrder(state.selectedOrder.id);showNotice("Serviço registrado na comanda.");
 });
}
root.addEventListener("click",async event=>{
 try{
 const page=event.target.closest("[data-page]");
 if(page){state.page=page.dataset.page;state.selectedOrder=null;state.selectedAppointment=null;state.notice="";render();return;}
 const date=event.target.closest("[data-date]");
 if(date){
  const next=new Date(date.dataset.date+"T12:00:00"),changed=next.getMonth()!==state.month.getMonth()||next.getFullYear()!==state.month.getFullYear();
  state.selectedDate=next;if(changed){state.month=new Date(next.getFullYear(),next.getMonth(),1);await loadAppointments();}render();return;
 }
 const appointment=event.target.closest("[data-appointment]");
 if(appointment){state.selectedAppointment=state.appointments.find(a=>a.id===appointment.dataset.appointment)||null;render();return;}
 const order=event.target.closest("[data-order]");
 if(order){await chooseOrder(order.dataset.order);return;}
 const action=event.target.closest("[data-action]")?.dataset.action;
 if(action==="prev-month"||action==="next-month"){state.month=new Date(state.month.getFullYear(),state.month.getMonth()+(action==="next-month"?1:-1),1);state.selectedDate=new Date(state.month.getFullYear(),state.month.getMonth(),1);await loadAppointments();render();}
 if(action==="back-orders"){state.selectedOrder=null;state.orderItems=[];render();}
 if(action==="close-appointment"){state.selectedAppointment=null;render();}
 if(action==="logout"){await supabase.auth.signOut();state.user=null;state.professional=null;loginView();}
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
 }catch(error){state.notice=error.message||"Não foi possível entrar.";loginView();}
 finally{if(button){button.disabled=false;button.textContent="Entrar";}}
 }catch(error){reportError(error,{context:"App Profissional > envio de formulário"});}
});
// Inicialização do PWA: sessão existente ou tela de login.
async function boot(){
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
 const {data,error}=await supabase.auth.getSession();
 if(error){reportError(error,{context:"App Profissional > recuperar sessão"});state.notice="Não foi possível recuperar sua sessão.";loginView();return;}
 if(data.session?.user){
  state.user=data.session.user;
  if(state.user.user_metadata?.must_change_password){changePasswordView();return;}
  try{await loadBase();}catch(error){reportError(error,{context:"App Profissional > inicializar dados da sessão"});state.notice="Não foi possível carregar seus dados. Entre novamente ou contate o administrador.";await supabase.auth.signOut();loginView();}
 }else loginView();
}
boot();
