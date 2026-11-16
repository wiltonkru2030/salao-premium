/** Painel administrativo: inicializa sessão, tenant e recursos globais; delega os eventos da Agenda ao controlador de domínio. */
import { state } from './state.js';
import { supabase } from './supabase/client.js';
import { render } from './layout/render.js';
import { installGlobalMasks } from './utils/input-masks.js';
import { installGlobalErrorHandlers, reportError } from './utils/errors.js';
import { startAuth, getCurrentUserContext } from './auth/auth.js';
import { installAgendaController } from './agenda/controllers/agenda-controller.js';

// Inicializa máscaras, mensagens de erro e eventos da Agenda antes do primeiro render.
installGlobalMasks();
installGlobalErrorHandlers();
installAgendaController();

async function loadBranchOptions(organizationId){
  const {data,error}=await supabase.from('branches').select('id,name,is_main,active').eq('org_id',organizationId).eq('active',true).order('is_main',{ascending:false}).order('name');
  if(error)throw error;
  if(state.organization?.id!==organizationId)return;
  const rows=data||[];
  const main=rows.find(item=>item.is_main);
  state.availableBranches=[
    ...(main?[{id:null,name:main.name||'Matriz',is_main:true}]:[]),
    ...rows.filter(item=>!item.is_main)
  ];
  const currentBranchId=state.branch?.id||null;
  const currentIsAllowed=state.availableBranches.some(item=>(item.id||null)===currentBranchId);
  if(!currentIsAllowed){
    const firstAllowed=state.availableBranches[0];
    state.branch=firstAllowed?.id?firstAllowed:null;
  }
}

document.addEventListener("change",async event=>{
  if(event.target?.id==="branch-switcher"){
    const select=event.target,branchId=String(select.value||"__main__");
    const selected=state.availableBranches.find(item=>String(item.id||"__main__")===branchId);
    if(!selected)return;
    select.disabled=true;
    state.branch=selected.id?selected:null;
    state.drawer=null;state.agendaAppointments=[];state.agendaProfessionals=[];state.dbBlockedTimes=[];
    render();
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
    await loadBranchOptions(context.organization.id);
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

startAuth(async context=>{
  state.user=context.user;
  state.profile=context.profile;
  state.organization=context.organization;
  state.membership=context.membership;
  state.availableOrganizations=context.availableOrganizations||[];
  state.branch=null;
  try{await loadBranchOptions(context.organization.id);}catch(error){reportError(error,{context:"SaaS > carregar unidades"});}
  render();
  // A tela inicial foi montada; erros posteriores pertencem ao tratamento global da aplicação.
  window.__SALAO_PREMIUM_BOOTED__=true;
});
