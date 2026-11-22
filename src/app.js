/** Painel administrativo: inicializa sessão, tenant e recursos globais; delega os eventos da Agenda ao controlador de domínio. */
// Usa o alias renderApp para evitar colisão com a importação existente na base main durante o merge.
import { state } from './state.js';
import { installGlobalMasks } from './utils/input-masks.js';
import { installGlobalErrorHandlers, reportError } from './utils/errors.js';
import { startAuth, getCurrentUserContext } from './auth/auth.js';
import { installAgendaController } from './agenda/controllers/agenda-controller.js';
import { render as renderApp } from './layout/render.js';
import { supabase } from './supabase/client.js';
import { resolveBranchContext } from './modules/branches/branch-context.service.js';

// Inicializa máscaras, mensagens de erro e eventos da Agenda antes do primeiro render.
installGlobalMasks();
installGlobalErrorHandlers();
installAgendaController();

// Carrega unidades ativas da organização e escolhe a matriz como contexto inicial.
async function refreshBranchContext() {
  // A consulta à filial pode terminar depois do logout ou troca de organização.
  const orgId=state.organization?.id,userId=state.user?.id;
  const isCurrent=()=>state.organization?.id===orgId&&state.user?.id===userId;
  try {
    const context=await resolveBranchContext({
      client:supabase,orgId,
      role:state.membership?.role,userId,
      previousBranchId:state.branch?.id||null
    });
    if(!isCurrent())return;
    state.availableBranches=context.branches;
    state.branch=context.branch;
  } catch(error) {
    if(!isCurrent())return;
    state.availableBranches=[];
    state.branch=null;
    reportError(error,{context:"SaaS > carregar unidades"});
  }
}

document.addEventListener("change",async event=>{
  if(event.target?.id==="branch-switcher") {
    const selectedValue=String(event.target.value||"");
    const selected=selectedValue==="__all__"
      ?{id:null,name:"Todas as unidades",isAll:true}
      :state.availableBranches.find(branch=>branch.id===selectedValue);
    if(!selected)return;
    state.branch=selected;
    state.agendaAppointments=[];
    state.agendaProfessionals=[];
    state.dbBlockedTimes=[];
    renderApp();
    return;
  }
  if(event.target?.id!=="tenant-switcher")return;
  const select=event.target,organizationId=String(select.value||"");
  if(!organizationId||organizationId===state.organization?.id)return;
  select.disabled=true;
  const previousUserId=state.user?.id;
  try{
    const context=await getCurrentUserContext(organizationId);
    if(!previousUserId||state.user?.id!==previousUserId||context.user?.id!==previousUserId)return;
    state.user=context.user;
    state.profile=context.profile;
    state.organization=context.organization;
    state.membership=context.membership;
    state.availableOrganizations=context.availableOrganizations||[];
    state.branch=null;
    await refreshBranchContext();
    state.page="Dashboard";
    state.drawer=null;
    state.query="";
    state.filter="Todos";
    state.pro=0;
    state.date=new Date();
    state.agendaAppointments=[];
    state.agendaProfessionals=[];
    state.dbBlockedTimes=[];
    renderApp();
  }catch(error){
    reportError(error,{context:"SaaS > trocar organização"});
    select.value=state.organization?.id||"";
  }finally{
    if(select.isConnected)select.disabled=false;
  }
});

startAuth(async (context,isCurrent)=>{
  if(!isCurrent())return;
  state.user=context.user;
  state.profile=context.profile;
  state.organization=context.organization;
  state.membership=context.membership;
  state.availableOrganizations=context.availableOrganizations||[];
  state.branch=null;
  await refreshBranchContext();
  // Jamais renderizar uma sessão que foi substituída enquanto a filial carregava.
  if(!isCurrent())return;
  renderApp();
  // A tela inicial foi montada; erros posteriores pertencem ao tratamento global da aplicação.
  window.__SALAO_PREMIUM_BOOTED__=true;
});
