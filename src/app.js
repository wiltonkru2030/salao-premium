/** Painel administrativo: inicializa sessão, tenant e recursos globais; delega os eventos da Agenda ao controlador de domínio. */
import { state } from './state.js';
import { installGlobalMasks } from './utils/input-masks.js';
import { installGlobalErrorHandlers, reportError } from './utils/errors.js';
import { startAuth, getCurrentUserContext } from './auth/auth.js';
import { installAgendaController } from './agenda/controllers/agenda-controller.js';

// Inicializa máscaras, mensagens de erro e eventos da Agenda antes do primeiro render.
installGlobalMasks();
installGlobalErrorHandlers();
installAgendaController();

document.addEventListener("change",async event=>{
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
    state.page="Dashboard";
    state.drawer=null;
    state.query="";
    state.filter="Todos";
    state.pro=0;
    state.date=new Date();
    state.agendaAppointments=[];
    state.agendaProfessionals=[];
    state.dbBlockedTimes=[];
    render();
  }catch(error){
    reportError(error,{context:"SaaS > trocar organização"});
    select.value=state.organization?.id||"";
  }finally{
    if(select.isConnected)select.disabled=false;
  }
});

startAuth(context=>{
  state.user=context.user;
  state.profile=context.profile;
  state.organization=context.organization;
  state.membership=context.membership;
  state.availableOrganizations=context.availableOrganizations||[];
  state.branch=null;
  render();
  // A tela inicial foi montada; erros posteriores pertencem ao tratamento global da aplicação.
  window.__SALAO_PREMIUM_BOOTED__=true;
});
