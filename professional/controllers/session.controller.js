/** Ciclo de sessão, seleção de salão/unidade e formulários de acesso. Sem estado global. */
import {authenticateProfessional} from "../auth.service.js";
import {fetchProfessionalContexts,verifyProfessionalSession,sameProfessionalScope,ProfessionalSessionError} from "../session.service.js";
import {requiresProfessionalPasswordChange,completeProfessionalPasswordChange} from "../password.service.js";
import {fetchProfessionalBranches,selectProfessionalBranch} from "../branches.service.js";
import {salonCalendarDate} from "../utils/salon-time.js";
import {allowedProfessionalPages} from "../access.rules.js";
import {escapeHtml as esc} from "../utils/formatters.js";
import {renderPlatformMark} from "../../src/components/platform-mark.js";
/** Coordena acesso com geração injetada e expõe somente operações do ciclo de sessão. */
export function createSessionController({state,root,supabase,getEpoch,clearPrivateState,clearAutocomplete,loginView,changePasswordView,render,reportError,loadAppointments,loadNotifications,notificationsEnabled}){
 let recheckingSession=false,endingSession=false,loginPending=false;
 /** Limpa a interface imediatamente; encerra apenas a sessão profissional local. */
 async function endSession(notice=""){
  if(endingSession)return;
  endingSession=true;clearPrivateState();state.notice=notice;loginView();
  try{const {error}=await supabase.auth.signOut({scope:"local"});if(error)throw error;}
  catch{state.notice=notice||"Não foi possível confirmar o encerramento da sessão. Confira a conexão.";loginView();}
  finally{endingSession=false;}
 }
 
 // Resolve vínculo, escopo e permissões antes de liberar os módulos.
 async function loadBase(selectedOrgId=null,selectedBranchId=null){
  const userId=state.user?.id;
  if(!userId)throw new Error("Sua sessão expirou.");
  // Retira dados do contexto anterior antes de consultar novas permissões.
  const user=state.user;clearPrivateState();state.user=user;
  const loadEpoch=getEpoch();
  root.innerHTML='<div class="boot" role="status">Carregando acesso ao salão…</div>';
  let contexts=await fetchProfessionalContexts(supabase,userId);
  if(loadEpoch!==getEpoch())return;
  const names=await supabase.from("organizations").select("id,name,timezone,currency").in("id",contexts.map(c=>c.orgId));
  if(loadEpoch!==getEpoch())return;
  if(names.error)throw new Error("Não foi possível consultar os salões vinculados.");
  const orgs=new Map((names.data||[]).map(o=>[o.id,o]));
  contexts=contexts.filter(c=>orgs.has(c.orgId));
  if(!contexts.length)throw new Error("Não foi possível identificar um salão autorizado.");
  state.contextCount=contexts.length;
  const context=selectedOrgId?contexts.find(c=>c.orgId===selectedOrgId):contexts.length===1?contexts[0]:null;
  if(!context){
   clearAutocomplete();
   root.innerHTML='<main class="login"><div class="brand sp-professional-brand">' + renderPlatformMark() + '<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div><h1>Escolha o salão</h1><p>Seus dados ficam separados por estabelecimento.</p>'+contexts.map(c=>'<button type="button" class="primary" data-context-org="'+esc(c.orgId)+'">'+esc(orgs.get(c.orgId)?.name||"Salão")+'</button>').join("")+'<button class="secondary" data-action="logout">Sair</button></main>';
   return;
  }
  Object.assign(state,context,{organization:orgs.get(context.orgId),notificationsEnabled});
  if(state.role==="professional"){
   const branches=await fetchProfessionalBranches({client:supabase,organizationId:state.orgId,professional:state.professional});
   if(loadEpoch!==getEpoch())return;
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
  if(loadEpoch!==getEpoch())return;
  if(profileResult.error)throw new Error("Não foi possível carregar seu perfil.");
  state.profile=profileResult.data;
  await loadAppointments();
  if(loadEpoch!==getEpoch())return;
  state.notice="";render();
  // Contador de avisos é independente da primeira renderização; não bloqueia Agenda.
  if(allowedProfessionalPages(state).includes("Notificações"))void loadNotifications();
 }
 
 /** Oculta dados quando não é possível verificar a conta; permite retomar sessão válida. */
 function sessionRetryView(message){
  clearPrivateState();
  root.innerHTML='<main class="auth-shell professional-auth"><section class="auth-panel"><h1>Verificar acesso</h1><p role="alert">'+esc(message)+'</p><button class="primary" data-action="retry-professional-session">Tentar novamente</button><button class="secondary" data-action="logout">Sair</button></section></main>';
 }
 /** Revalida ao retornar ao app, preservando a página quando as permissões não mudaram. */
 async function recheckSession(){
  if(!state.user||!state.orgId||recheckingSession||endingSession)return;
  const epoch=getEpoch(),previous={orgId:state.orgId,role:state.role,scope:state.scope,professional:state.professional};
  recheckingSession=true;
  try{
   const user=await verifyProfessionalSession(supabase);
   if(epoch!==getEpoch())return;
   if(user.id!==state.user.id){await endSession("A conta foi alterada. Entre novamente.");return;}
   if(requiresProfessionalPasswordChange(user)){clearPrivateState();state.user=user;changePasswordView();return;}
   const contexts=await fetchProfessionalContexts(supabase,user.id);
   if(epoch!==getEpoch())return;
   const next=contexts.find(context=>context.orgId===previous.orgId);
   if(!next){await endSession("Seu acesso ao salão foi alterado. Entre novamente.");return;}
   if(!sameProfessionalScope(previous,next)){state.user=user;await loadBase(previous.orgId);return;}
   if(state.role==="professional"){
    const branches=await fetchProfessionalBranches({client:supabase,organizationId:previous.orgId,professional:next.professional});
    if(epoch!==getEpoch())return;
    if(!branches.some(row=>row.id===state.branchId)){await loadBase(previous.orgId);return;}
    state.branches=branches;
   }
   state.user=user;state.contextCount=contexts.length;
  }catch(error){
   if(epoch!==getEpoch())return;
   if(error instanceof ProfessionalSessionError&&["EXPIRED","DISABLED","NO_CONTEXT"].includes(error.code))await endSession(error.message);
   else sessionRetryView("Não foi possível verificar seu acesso. Confira a conexão e tente novamente.");
  }finally{recheckingSession=false;}
 }
 /** Inicializa sessão persistida sem confundir falhas de rede com credenciais inválidas. */
 async function boot(){
  if(recheckingSession||endingSession||loginPending)return;
  recheckingSession=true;const epoch=getEpoch();
  try{
   if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{});
   const user=await verifyProfessionalSession(supabase);
   if(epoch!==getEpoch())return;
   state.user=user;
   if(requiresProfessionalPasswordChange(user)){changePasswordView();return;}
   await loadBase();
  }catch(error){
   if(error instanceof ProfessionalSessionError&&error.code==="EXPIRED"){clearPrivateState();state.notice="";loginView();}
   else if(error instanceof ProfessionalSessionError&&["DISABLED","NO_CONTEXT"].includes(error.code))await endSession(error.message);
   else sessionRetryView("Não foi possível recuperar seu acesso. Confira a conexão e tente novamente.");
  }finally{recheckingSession=false;}
 }
 /** Trata apenas os formulários de acesso; não registra credenciais. */
 async function submitAuth(event){
 try{
  if(event.target.matches("#professional-password-change")){
   if(!state.user||!requiresProfessionalPasswordChange(state.user)||endingSession){event.preventDefault();return;}
   const epoch=getEpoch();
   event.preventDefault();const values=new FormData(event.target),password=String(values.get("password")||""),confirm=String(values.get("confirm")||"");
   if(password.length<10||password!==confirm){state.notice="As senhas devem ser iguais e ter pelo menos 10 caracteres.";changePasswordView();return;}
   const button=event.target.querySelector("button[type=submit]");if(button.disabled)return;button.disabled=true;button.textContent="Salvando…";
   if(state.user?.app_metadata?.professional_password_required===true){
    try{
     await completeProfessionalPasswordChange({client:supabase,currentPassword:String(values.get("currentPassword")||""),password,confirm});
     if(epoch===getEpoch())await endSession("Senha atualizada. Entre novamente com a nova senha.");
    }catch(error){if(epoch===getEpoch()){state.notice=error.message;changePasswordView();}}
    finally{button.disabled=false;}
    return;
   }
   const {error}=await supabase.auth.updateUser({password});
   if(epoch!==getEpoch())return;
   if(error){reportError(error,{context:"App Profissional > troca obrigatória de senha"});state.notice="Não foi possível alterar a senha. Confira os requisitos e tente novamente.";changePasswordView();return;}
   const {error:metaError}=await supabase.auth.updateUser({data:{must_change_password:false}});
   if(epoch!==getEpoch())return;
   if(metaError){reportError(metaError,{context:"App Profissional > concluir troca obrigatória de senha"});state.notice="Senha alterada, mas não foi possível concluir a atualização do acesso. Entre novamente.";changePasswordView();return;}
   const {data:userData,error:userError}=await supabase.auth.getUser();
   if(epoch!==getEpoch())return;
   if(userError||!userData?.user){if(userError)reportError(userError,{context:"App Profissional > confirmar sessão após troca de senha"});state.notice="Entre novamente para continuar.";await supabase.auth.signOut();loginView();return;}
   state.user=userData.user;await loadBase();return;
  }
  if(!event.target.matches("#professional-login"))return;
  event.preventDefault();if(endingSession||recheckingSession)return;const values=new FormData(event.target),login=String(values.get("login")||"").trim(),password=String(values.get("password")||"");
  const epoch=getEpoch(),button=event.target.querySelector("button[type=submit]");if(button.disabled||loginPending)return;loginPending=true;button.disabled=true;button.textContent="Validando…";
  try{
   const user=await authenticateProfessional({client:supabase,login,password});
   if(epoch!==getEpoch())return;
   state.user=user;state.notice="";
   if(requiresProfessionalPasswordChange(state.user)){changePasswordView();return;}
   await loadBase();
  }catch(error){
   if(epoch!==getEpoch()&&!state.user)return;
   const message=error instanceof ProfessionalSessionError?error.message:"Não foi possível entrar. Confira suas credenciais e permissões.";
   if(state.user)await endSession(message);else{state.notice=message;loginView();}
  }
  finally{loginPending=false;if(button){button.disabled=false;button.textContent="Entrar";}}
  }catch(error){reportError(error,{context:"App Profissional > envio de formulário"});}
 }
 /** Instala eventos externos de sessão uma única vez, fora do callback do SDK. */
 function start(){
  supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"&&!endingSession){clearPrivateState();state.notice="Sua sessão terminou. Entre novamente.";loginView();}
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void recheckSession();});
  return boot();
 }
 return {loadBase,endSession,boot,submitAuth,start};
}
