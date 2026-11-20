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
  try {
    const context=await resolveBranchContext({
      client:supabase,orgId:state.organization?.id,
      role:state.membership?.role,userId:state.user?.id,
      previousBranchId:state.branch?.id||null
    });
    state.availableBranches=context.branches;
    state.branch=context.branch;
  } catch(error) {
    state.availableBranches=[];
    state.branch=null;
    reportError(error,{context:"SaaS > carregar unidades"});
  }
}

document.addEventListener("change",async event=>{
  if(event.target?.id==="branch-switcher") {
    const selected=state.availableBranches.find(branch=>branch.id===String(event.target.value||""));
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
  try{
    const context=await getCurrentUserContext(organizationId);
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

startAuth(async context=>{
  state.user=context.user;
  state.profile=context.profile;
  state.organization=context.organization;
  state.membership=context.membership;
  state.availableOrganizations=context.availableOrganizations||[];
  state.branch=null;
  await refreshBranchContext();
  renderApp();
  // A tela inicial foi montada; erros posteriores pertencem ao tratamento global da aplicação.
  window.__SALAO_PREMIUM_BOOTED__=true;
});
