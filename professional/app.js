import { supabase } from "../src/supabase/client.js";
import { mountAutocomplete } from "../src/components/autocomplete.js";

const root = document.querySelector("#professional-app");
const state = { user:null, orgId:null, role:null, scope:"none", professional:null, profile:null, organization:null, page:"Agenda", month:new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDate:new Date(), selectedAppointment:null, appointments:[], orders:[], services:[], commissions:[], selectedOrder:null, selectedService:null, notice:"" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateKey = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const monthLabel = date => date.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
const dateLabel = date => date.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
function showNotice(message){state.notice=message;render();if(state.page==="Comanda"&&state.selectedOrder)bindAutocomplete();}
function changePasswordView(){
 root.innerHTML=`<main class="login"><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Crie sua nova senha</h1><p>Por segurança, altere a senha temporária antes de continuar.</p>${state.notice?`<div class="notice">${esc(state.notice)}</div>`:""}<form id="professional-password-change"><label class="field">Nova senha<input name="password" type="password" minlength="10" autocomplete="new-password" placeholder="Mínimo de 10 caracteres" required></label><label class="field">Confirmar senha<input name="confirm" type="password" minlength="10" autocomplete="new-password" placeholder="Digite novamente" required></label><button class="primary" type="submit">Salvar nova senha</button></form><p class="muted">A alteração é obrigatória para proteger seu acesso.</p></main>`;
}
function loginView(){
 root.innerHTML=`<main class="login"><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Bem-vindo(a)</h1><p>Profissionais entram com CPF e senha. Proprietários e pessoas autorizadas podem usar o e-mail.</p>${state.notice?`<div class="notice">${esc(state.notice)}</div>`:""}<form id="professional-login"><label class="field">CPF ou e-mail<input name="login" inputmode="text" autocomplete="username" placeholder="000.000.000-00 ou seu e-mail" required></label><label class="field">Senha<input name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required></label><button class="primary" type="submit">Entrar</button></form><p class="muted">Esqueceu a senha? Solicite a redefinição ao administrador do salão.</p></main>`;
}
function shell(content){
 root.innerHTML=`<div class="app-shell"><header class="top"><div><div class="brand">SALÃO PREMIUM<small>APP PROFISSIONAL</small></div><h1>Olá, ${esc(state.professional?.name?.split(" ")[0] || "profissional")}</h1></div><button class="icon-button" data-action="logout" aria-label="Sair">↪</button></header><main class="content">${state.notice?`<div class="notice">${esc(state.notice)}</div>`:""}${content}</main><nav class="nav">${[["Agenda","▦"],["Comandas","▤"],["Comissões","％"],["Configurações","⚙"]].map(([label,icon])=>`<button data-page="${label}" class="${state.page===label?"active":""}"><span>${icon}</span>${label}</button>`).join("")}</nav></div>`;
}
function appointmentCard(a){
 const startDate=new Date(a.starts_at),endDate=new Date(a.ends_at);
 const time = startDate.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
 const duration=Math.max(0,Math.round((endDate-startDate)/60000));
 const professional=a.professional_name||state.professional?.name||"—";
 const source = ({customer:"Cliente",salon:"Salão",professional:"Profissional"})[a.booking_source] || "Salão";
 return `<article class="appointment"><strong>${time} · ${esc(a.customer_name)}</strong><div class="meta">${esc(a.service_name)} · ${endDate.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}<br>${esc(a.customer_phone || "Telefone não informado")} · ${money(a.price)}<br>Profissional: ${esc(professional)} · Duração: ${duration} min</div><span class="tag">${esc(a.status)} · Agendado por: ${source}</span>${a.notes?`<div class="meta">${esc(a.notes)}</div>`:""}</article>`;
}
function appointmentDetailView(){
 const a=state.selectedAppointment;if(!a)return "";
 const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
 return '<section class="detail"><div class="section-title"><h2>Detalhes do agendamento</h2><button class="secondary" data-action="close-appointment">Fechar</button></div>'+
 '<div class="detail-row"><span>Cliente</span><b>'+esc(a.customer_name)+'</b></div>'+
 '<div class="detail-row"><span>Telefone</span><b>'+esc(a.customer_phone||"—")+'</b></div>'+
 '<div class="detail-row"><span>Serviço</span><b>'+esc(a.service_name)+'</b></div>'+
 '<div class="detail-row"><span>Profissional</span><b>'+esc(a.professional_name||state.professional?.name||"—")+'</b></div>'+
 '<div class="detail-row"><span>Data</span><b>'+new Date(a.starts_at).toLocaleDateString("pt-BR")+'</b></div>'+
 '<div class="detail-row"><span>Horário</span><b>'+formatTime(a.starts_at)+'–'+formatTime(a.ends_at)+'</b></div>'+
 '<div class="detail-row"><span>Duração</span><b>'+duration+' minutos</b></div>'+
 '<div class="detail-row"><span>Valor</span><b>'+money(a.price)+'</b></div>'+
 '<div class="detail-row"><span>Status</span><b>'+esc(statusLabel(a.status))+'</b></div>'+
 '<div class="detail-row"><span>Origem</span><b>'+esc(sourceLabel(a.booking_source))+'</b></div>'+
 '<div class="detail-row"><span>Quem criou</span><b>'+esc(a.created_by_name||sourceLabel(a.booking_source))+'</b></div>'+
 '<div class="detail-row"><span>Observações</span><b>'+esc(a.notes||"—")+'</b></div></section>';
}
function agendaView(){
 const year=state.month.getFullYear(),month=state.month.getMonth(),first=new Date(year,month,1),offset=first.getDay(),days=new Date(year,month+1,0).getDate(),prevDays=new Date(year,month,0).getDate();
 const apptDays=new Set(state.appointments.map(a=>dateKey(new Date(a.starts_at))));
 const cells=[];
 for(let i=0;i<42;i++){let d,inside=true;if(i<offset){d=new Date(year,month-1,prevDays-offset+i+1);inside=false}else if(i>=offset+days){d=new Date(year,month+1,i-offset-days+1);inside=false}else d=new Date(year,month,i-offset+1);
 const key=dateKey(d),cls=[inside?"":"outside",key===dateKey(state.selectedDate)?"selected":"",key===dateKey(new Date())?"today":""].join(" ");
 cells.push(`<button class="day ${cls}" data-date="${key}">${d.getDate()}${apptDays.has(key)?'<i class="dot"></i>':""}</button>`);}
 const selected=state.appointments.filter(a=>dateKey(new Date(a.starts_at))===dateKey(state.selectedDate)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
 return `<div class="section-title"><h2>Agenda mensal</h2><span class="muted">Somente sua agenda</span></div><div class="calendar-head"><button data-action="prev-month">‹</button><strong>${esc(monthLabel(state.month))}</strong><button data-action="next-month">›</button></div><div class="calendar">${["D","S","T","Q","Q","S","S"].map(d=>`<div class="weekday">${d}</div>`).join("")}${cells.join("")}</div><div class="section-title" style="margin-top:24px"><h2>${esc(dateLabel(state.selectedDate))}</h2><span class="muted">${selected.length} agendamento(s)</span></div>${selected.length?selected.map(appointmentCard).join(""):'<div class="empty">Nenhum agendamento neste dia.</div>'}`;
}

function ordersView(){
 if(state.selectedOrder){const order=state.selectedOrder;return `<button class="secondary" data-action="back-orders">← Voltar às comandas</button><div class="detail"><strong>Comanda #${esc(order.order_number)}</strong><div class="detail-row"><span>Status</span><b>${esc(order.status)}</b></div><div class="detail-row"><span>Total</span><b>${money(order.total)}</b></div></div><div class="section-title"><h2>Serviços registrados</h2></div><div id="order-items"><div class="empty">Carregando itens…</div></div><div class="detail"><strong>Registrar serviço realizado</strong><label class="field service-search">Buscar serviço<input id="service-search" placeholder="Digite o nome do serviço" autocomplete="off"><div id="service-suggestions" class="suggestions"></div></label><button class="primary" id="add-service" disabled>Registrar serviço</button><p class="muted">O registro fica vinculado ao seu perfil. Você não pode alterar valores, produtos ou finalizar pagamentos.</p></div>`; }
 return `<div class="section-title"><h2>Minhas comandas</h2><span class="muted">Acesso restrito</span></div>${state.orders.length?state.orders.map(o=>`<button class="order" style="display:block;width:100%;text-align:left" data-order="${o.id}"><strong>Comanda #${esc(o.order_number)}</strong><div class="meta">Status: ${esc(o.status)} · ${money(o.total)}</div></button>`).join(""):'<div class="empty">Nenhuma comanda vinculada à sua agenda no momento.</div>'}`;
}
function commissionsView(){return `<div class="section-title"><h2>Minhas comissões</h2><span class="muted">Somente seus lançamentos</span></div>${state.commissions.length?state.commissions.map(c=>`<article class="commission"><strong>${money(c.amount)}</strong><div class="meta">Base: ${money(c.base_amount)} · Taxa: ${Number(c.rate)}%</div><span class="tag">${esc(c.status)}</span></article>`).join(""):'<div class="empty">Nenhuma comissão registrada.</div>'}`;}
function settingsView(){return `<div class="section-title"><h2>Configurações</h2></div><div class="detail"><div class="detail-row"><span>Profissional</span><b>${esc(state.professional?.name)}</b></div><div class="detail-row"><span>Salão</span><b>${esc(state.profile?.organizationName||"Conta vinculada")}</b></div><div class="detail-row"><span>Login</span><b>CPF</b></div><div class="detail-row"><span>Senha</span><b>Redefinição pelo administrador</b></div></div><button class="secondary" data-action="logout">Sair da conta</button>`;}
function render(){
 const content=state.page==="Agenda"?agendaView():state.page==="Comandas"?ordersView():state.page==="Comissões"?commissionsView():settingsView();
 shell(content);
}
async function loadBase(){
 const {data:membership,error:mError}=await supabase.from("org_memberships")
  .select("org_id,role,status,professional_app_enabled,professional_app_scope")
  .eq("user_id",state.user.id).eq("status","active").limit(1).maybeSingle();
 if(mError||!membership)throw new Error("Esta conta não está vinculada a um salão ativo.");
 state.orgId=membership.org_id;state.role=membership.role;state.professional=null;
 const [profileResult,orgResult]=await Promise.all([
  supabase.from("profiles").select("full_name,phone").eq("id",state.user.id).maybeSingle(),
  supabase.from("organizations").select("id,name,timezone,currency").eq("id",state.orgId).maybeSingle()
 ]);
 if(profileResult.error)throw profileResult.error;
 if(orgResult.error)throw orgResult.error;
 state.profile=profileResult.data;state.organization=orgResult.data;
 if(state.role==="professional"){
  const {data:pro,error}=await supabase.from("professionals").select("id,name,profile_id,org_id,active,access_enabled")
   .eq("profile_id",state.user.id).eq("org_id",state.orgId).eq("active",true).eq("access_enabled",true).maybeSingle();
  if(error||!pro)throw new Error("Seu cadastro profissional não está ativo ou o acesso foi desabilitado.");
  state.professional=pro;state.scope="self";
 } else if(state.role==="owner"||state.role==="admin"){
  state.scope="all";
 } else if(membership.professional_app_enabled===true&&["all","self"].includes(membership.professional_app_scope)){
  state.scope=membership.professional_app_scope;
 } else {
  throw new Error("O administrador ainda não liberou o App Profissional para esta conta.");
 }
 if(state.scope==="self"&&!state.professional)throw new Error("O acesso individual exige um cadastro profissional vinculado.");
 await Promise.all([loadAppointments(),loadOrders(),loadServices(),loadCommissions()]);
 render();
}
async function loadAppointments(){
 const start=new Date(state.month.getFullYear(),state.month.getMonth(),1),end=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);
 const {data,error}=await supabase.from("appointments").select("id,starts_at,ends_at,customer_name,customer_phone,service_name,professional_name,status,price,booking_source,notes").eq("org_id",state.orgId).gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString()).order("starts_at");
 if(error) throw error; state.appointments=data||[];
}
async function loadOrders(){
 const {data,error}=await supabase.from("service_orders").select("id,order_number,status,total,assigned_professional_id,customer_id").eq("org_id",state.orgId).order("created_at",{ascending:false}).limit(50);
 if(error) throw error; state.orders=data||[];
}
async function loadServices(){
 const {data,error}=await supabase.from("services").select("id,name,category,duration_minutes,price").eq("org_id",state.orgId).eq("active",true).order("name").limit(100);
 if(error) throw error; state.services=data||[];
}
async function loadCommissions(){
 const {data,error}=await supabase.from("commissions").select("id,base_amount,rate,amount,status,created_at").eq("org_id",state.orgId).order("created_at",{ascending:false}).limit(100);
 if(error) throw error; state.commissions=data||[];
}
async function loadOrderItems(){
 const host=document.querySelector("#order-items");if(!host||!state.selectedOrder)return;
 const {data,error}=await supabase.from("service_order_items").select("id,description,quantity,unit_price,total,performed_at").eq("org_id",state.orgId).eq("order_id",state.selectedOrder.id).order("created_at");
 if(error){host.innerHTML='<div class="empty">Não foi possível carregar os itens.</div>';return;}
 host.innerHTML=data?.length?data.map(i=>`<article class="service"><strong>${esc(i.description)}</strong><div class="meta">${Number(i.quantity)} × ${money(i.unit_price)} · ${money(i.total)}</div></article>`).join(""):'<div class="empty">Nenhum serviço registrado por você nesta comanda.</div>';
}
async function chooseOrder(id){
 state.selectedOrder=state.orders.find(o=>o.id===id)||null;render();await loadOrderItems();
}
let cleanupAutocomplete=null;
function bindAutocomplete(){
 const input=document.querySelector("#service-search"),button=document.querySelector("#add-service");
 if(!input||!button)return;
 cleanupAutocomplete?.();
 cleanupAutocomplete=mountAutocomplete(input,{
  search:async term=>state.services.filter(s=>s.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
  getLabel:item=>item.name+" · "+money(item.price),
  onSelect:item=>{state.selectedService=item;button.disabled=!item;}
 });
 button.addEventListener("click",async()=>{
  if(!state.selectedService||!state.selectedOrder)return;
  button.disabled=true;button.textContent="Registrando…";
  const service=state.selectedService,price=Number(service.price||0);
  const {error}=await supabase.from("service_order_items").insert({org_id:state.orgId,order_id:state.selectedOrder.id,item_type:"service",service_id:service.id,professional_id:state.professional.id,description:service.name,quantity:1,unit_price:price,total:price,performed_at:new Date().toISOString(),created_by:state.user.id});
  if(error){showNotice("Não foi possível registrar o serviço. Verifique se a comanda está aberta e atribuída a você.");return;}
  state.selectedService=null;showNotice("Serviço registrado na comanda.");await loadOrders();await chooseOrder(state.selectedOrder.id);
 });
}
root.addEventListener("click",async event=>{
 const page=event.target.closest("[data-page]");if(page){state.page=page.dataset.page;state.selectedOrder=null;state.selectedAppointment=null;state.notice="";render();if(state.page==="Comandas")bindAutocomplete();return;}
 const date=event.target.closest("[data-date]");if(date){const nextDate=new Date(date.dataset.date+"T12:00:00");const changed=nextDate.getMonth()!==state.month.getMonth()||nextDate.getFullYear()!==state.month.getFullYear();state.selectedDate=nextDate;if(changed){state.month=new Date(nextDate.getFullYear(),nextDate.getMonth(),1);await loadAppointments();}render();return;}
 const order=event.target.closest("[data-order]");if(order){await chooseOrder(order.dataset.order);return;}
 const appt=event.target.closest("[data-appointment]");if(appt){state.selectedAppointment=state.appointments.find(a=>a.id===appt.dataset.appointment)||null;render();return;}
 const action=event.target.closest("[data-action]")?.dataset.action;
 if(action==="prev-month"||action==="next-month"){state.month=new Date(state.month.getFullYear(),state.month.getMonth()+(action==="next-month"?1:-1),1);await loadAppointments();render();}
 if(action==="back-orders"){state.selectedOrder=null;render();}
 if(action==="close-appointment"){state.selectedAppointment=null;render();}
 if(action==="logout"){await supabase.auth.signOut();state.user=null;state.professional=null;loginView();}
});
root.addEventListener("submit",async event=>{
 if(event.target.matches("#professional-password-change")){
  event.preventDefault();
  const values=new FormData(event.target),password=String(values.get("password")||""),confirm=String(values.get("confirm")||"");
  if(password.length<10||password!==confirm){state.notice="As senhas devem ser iguais e ter pelo menos 10 caracteres.";changePasswordView();return;}
  const button=event.target.querySelector("button[type=submit]");button.disabled=true;button.textContent="Salvando…";
  const {error}=await supabase.auth.updateUser({password,data:{must_change_password:false}});
  if(error){state.notice=error.message||"Não foi possível alterar a senha.";changePasswordView();return;}
  const {data:userData,error:userError}=await supabase.auth.getUser();if(userError||!userData.user){state.notice="Entre novamente para continuar.";await supabase.auth.signOut();loginView();return;}
  state.user=userData.user;state.notice="Senha atualizada.";try{await loadBase();}catch(loadError){state.notice=loadError.message;loginView();}
  return;
 }
 if(!event.target.matches("#professional-login"))return;
 event.preventDefault();const fd=new FormData(event.target),login=String(fd.get("login")||"").trim(),password=String(fd.get("password")||"");
 const button=event.target.querySelector("button[type=submit]");button.disabled=true;button.textContent="Validando…";
 try{
  if(login.includes("@")){
   const {error}=await supabase.auth.signInWithPassword({email:login.toLowerCase(),password});
   if(error)throw new Error("E-mail ou senha inválidos.");
   const {data:userData,error:userError}=await supabase.auth.getUser();if(userError||!userData.user)throw new Error("Não foi possível iniciar sua sessão.");
   state.user=userData.user;
  } else {
   const {data,error}=await supabase.functions.invoke("professional-cpf-login",{body:{cpf:login,password}});
   if(error||!data?.access_token||!data?.refresh_token)throw new Error(data?.error||"CPF ou senha inválidos.");
   const {error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
   const {data:userData,error:userError}=await supabase.auth.getUser();if(userError||!userData.user)throw new Error("Não foi possível iniciar sua sessão.");
   state.user=userData.user;
  }
  state.notice="";if(state.user.user_metadata?.must_change_password){changePasswordView();return;}await loadBase();
 }catch(error){state.notice=error.message||"Não foi possível entrar.";loginView();}
 finally{if(button){button.disabled=false;button.textContent="Entrar";}}
});
async function boot(){
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
 const {data,error}=await supabase.auth.getSession();
 if(error){state.notice="Não foi possível recuperar sua sessão.";loginView();return;}
 if(data.session?.user){state.user=data.session.user;if(state.user.user_metadata?.must_change_password){changePasswordView();return;}try{await loadBase();}catch(error){state.notice=error.message;await supabase.auth.signOut();loginView();}}
 else loginView();
}
boot();
