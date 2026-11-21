/** Página de Agenda administrativa. Responsabilidade: consultar dados do Supabase e montar filtros, calendário e visão de horários. */
import { expandCalendarBlocks } from '../utils/calendar-blocks.js';
import { state } from '../../state.js';
import { supabase } from '../../supabase/client.js';
import { head, btn, initials, esc } from '../../utils.js';
import { fetchAgendaCalendar } from '../services/calendar-query.service.js';
import { reportError } from '../../utils/errors.js';
import {mountAgendaOffers} from '../controllers/agenda-offers.controller.js';

/** @typedef {import('../../types/tenant.types').TenantContext} TenantContext */
/** @typedef {import('../../types/operations.types').AppointmentRecord} AppointmentRecord */
import { renderProfessionalSelector } from '../components/professional-selector.js';
import { renderAgendaToolbar } from '../components/agenda-toolbar.js';
import { renderDayCalendar } from '../components/day-calendar.js';
import { renderWeekCalendar } from '../components/week-calendar.js';
import { renderMonthCalendar } from '../components/month-calendar.js';
import { renderAgendaFilters } from '../components/agenda-filters.js';
import { dateKey, startOfWeek, addDays } from '../utils/date.utils.js';

export { dateKey };
let loadVersion=0;

// Adapta os estados do banco aos rótulos exibidos no calendário.
function dbStatus(value) {
  return ({scheduled:'Aguardando',confirmed:'Confirmado',arrived:'Cliente chegou',in_progress:'Em atendimento',completed:'Finalizado',cancelled:'Cancelado',no_show:'Falta'})[value] || value;
}
function asLocalDateTime(value) {
  const date=new Date(value);
  return {date:dateKey(date),time:date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
}
// Converte uma linha do Supabase no formato esperado pelos componentes visuais.
function toCalendarAppointment(row,professionalIndex) {
  const start=asLocalDateTime(row.starts_at);
  const duration=Math.max(5,Math.round((new Date(row.ends_at)-new Date(row.starts_at))/60000));
  return {
    id:row.id,name:row.customer_name,phone:row.customer_phone||'',service:row.service_name,
    pro:professionalIndex,professional_id:row.professional_id,
    professionalName:row.professional_name||'Profissional',
    customer_id:row.customer_id,service_id:row.service_id,branch_id:row.branch_id||null,
    date:start.date,time:start.time,duration,price:row.price,
    status:dbStatus(row.status),dbStatus:row.status,notes:row.notes||'',
    booking_source:row.booking_source,created_by_name:row.created_by_name||'',
    service_order_id:row.service_order_id,comanda_strategy:row.comanda_strategy,appointment_group_id:row.appointment_group_id||null,arrived_at:row.arrived_at||null
  };
}
// Compõe filtros, resumo e calendário sem executar consultas ao banco.
function buildContent() {
  const host=document.querySelector('#agenda-db-content');
  if(!host||state.page!=='Agenda')return;
  const professionals=state.agendaProfessionals||[];
  if(!professionals.length){
    host.innerHTML='<div class="sp-empty-workspace" role="status"><div class="sp-empty-symbol" aria-hidden="true">▦</div><span class="sp-empty-kicker">PREPARE SUA AGENDA</span><h2>Seu calendário começa com a equipe.</h2><p>Cadastre o primeiro profissional para disponibilizar horários, organizar serviços e receber agendamentos.</p><button type="button" class="btn primary" data-page="Profissionais">Cadastrar profissional</button></div>';
    return;
  }
  if(state.pro<0||state.pro>=professionals.length)state.pro=0;
  const selectedProfessional=professionals[state.pro];
  const key=dateKey(state.date);
  const query=String(state.query||'').trim().toLocaleLowerCase('pt-BR');
  const items=(state.agendaAppointments||[]).filter(a=>
    a.pro===state.pro &&
    (!state.filter||state.filter==='Todos'||a.status===state.filter) &&
    (!query||[a.name,a.service,a.phone,a.professionalName].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query)))
  );
  const count=items.filter(a=>a.date===key).length;
  let html=renderProfessionalSelector(state.pro,professionals);
  html+=renderAgendaToolbar(state.date,state.view);
  html+=renderAgendaFilters({query:state.query,filter:state.filter});
  html+='<div class="agenda-summary"><span><i class="legend-dot booked"></i> Agendado</span><span><i class="legend-dot progress"></i> Em atendimento</span><span><i class="legend-dot free"></i> Disponível</span><span class="summary-count">'+count+
' atendimento(s) para '+esc(selectedProfessional[1])+
'</span></div>';
  const props={date:state.date,pro:state.pro,professional:selectedProfessional,appointments:items,
    blockedTimes:state.dbBlockedTimes||[],includeReleased:state.filter==='Cancelado'||state.filter==='Falta'};
  html+=state.view==='Dia'?renderDayCalendar(props):state.view==='Semana'?renderWeekCalendar(props):renderMonthCalendar(props);
  html+='<div class="agenda-help">Selecione um atendimento para confirmar, reagendar, registrar chegada, abrir uma comanda ou cancelar. Alterações são registradas no banco e na auditoria.</div>';
  host.innerHTML=html;
}
/**
 * Renderiza o shell da página de Agenda e seu estado inicial de carregamento.
 * @returns {string} HTML da página administrativa.
 */
export function agenda() {
  return head('Agenda','Gerencie horários, atendimentos e disponibilidade dos profissionais.',btn('＋ Novo agendamento','new-appointment','primary'))+

    '<div id="agenda-db-content"><div class="empty-state">Carregando agenda do banco…</div></div>'+ 
    '<section id="agenda-offers-panel" class="surface agenda-offers-panel" aria-label="Pacotes e lista de espera"><p>Carregando módulos complementares…</p></section>';
}
// Consulta profissionais, agendamentos e bloqueios da organização ativa.
/**
 * Consulta profissionais, agendamentos e bloqueios do tenant ativo e renderiza o calendário.
 * @returns {Promise<void>} Atualiza o estado visual da Agenda; não altera dados persistidos.
 * @throws Erros são registrados com código de diagnóstico e exibidos em pt-BR.
 */
/**
 * Carrega a Agenda da organização ativa dentro do intervalo visível.
 * @returns {Promise<void>} Consulta somente; ações de gravação são orquestradas pelo app e banco.
 */
export async function loadAgendaPage() {
  if(!state.user||!state.organization?.id)return;
  const host=document.querySelector('#agenda-db-content');
  if(!host)return;
  const orgId=state.organization.id,userId=state.user.id,branchId=state.branch?.id||null;
  const version=++loadVersion;
  const requestedDate=dateKey(state.date),requestedView=state.view;
  // Impede que uma resposta antiga substitua outra data, visualização ou página.
  const isCurrent=()=>host.isConnected&&state.page==='Agenda'&&version===loadVersion&&state.organization?.id===orgId&&state.user?.id===userId&&(state.branch?.id||null)===branchId&&dateKey(state.date)===requestedDate&&state.view===requestedView;
  // Painel independente: não bloqueia o calendário nem recarrega a página.
  void mountAgendaOffers({client:supabase,state,onBooked:loadAgendaPage})
    .catch(error=>reportError(error,{context:"Agenda > módulos complementares",notify:false}));
  state.agendaProfessionals=[];state.agendaAppointments=[];state.dbBlockedTimes=[];
  host.innerHTML='<div class="empty-state">Carregando agenda…</div>';
  try{
    let start,end;
    if(state.view==='Dia'){
      start=new Date(state.date.getFullYear(),state.date.getMonth(),state.date.getDate());
      end=addDays(start,1);
    }else if(state.view==='Semana'){
      start=startOfWeek(state.date);
      end=addDays(start,7);
    }else{
      start=new Date(state.date.getFullYear(),state.date.getMonth(),1);
      end=new Date(state.date.getFullYear(),state.date.getMonth()+1,1);
    }
    const {professionals:dbProfessionals,appointments:appointmentRows,blocks}=await fetchAgendaCalendar({client:supabase,orgId,branchId,start,end});
    if(!isCurrent())return;
    state.agendaProfessionals=dbProfessionals.map(p=>[initials(p.name||'?'),p.name,'Profissional',p.id]);
    if(!state.agendaProfessionals.length){state.agendaAppointments=[];state.dbBlockedTimes=[];buildContent();return;}
    const indexById=new Map(dbProfessionals.map((p,i)=>[p.id,i]));
    state.agendaAppointments=(appointmentRows||[]).filter(a=>indexById.has(a.professional_id)).map(a=>toCalendarAppointment(a,indexById.get(a.professional_id)));
    state.dbBlockedTimes=expandCalendarBlocks(blocks,dbProfessionals,start,end);
    buildContent();
  }catch(error){
    if(!isCurrent())return;
    const diagnostic=reportError(error,{context:"Agenda > carregar calendário",notify:false});
    host.innerHTML='<div class="empty-state"><b>Não foi possível carregar a agenda.</b><small>Verifique sua conexão e suas permissões. Código '+diagnostic.id+
'</small></div>';
  }
}
/**
 * Atualiza somente o conteúdo visual da agenda usando o estado já carregado.
 * @returns {void} Recompõe filtros, resumo e calendário sem nova consulta.
 */
export function refreshAgendaContent(){buildContent();}
/**
 * Localiza no estado em memória a representação visual de um agendamento.
 * @param {string|number} id Identificador do agendamento.
 * @returns {object|null} Agendamento encontrado ou null.
 */
export function findAppointmentView(id){return (state.agendaAppointments||[]).find(a=>String(a.id)===String(id))||null;}
