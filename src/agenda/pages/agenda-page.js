import { state } from '../../state.js';
import { supabase } from '../../supabase/client.js';
import { head, btn, initials } from '../../utils.js';
import { renderProfessionalSelector } from '../components/professional-selector.js';
import { renderAgendaToolbar } from '../components/agenda-toolbar.js';
import { renderDayCalendar } from '../components/day-calendar.js';
import { renderWeekCalendar } from '../components/week-calendar.js';
import { renderMonthCalendar } from '../components/month-calendar.js';
import { renderAgendaFilters } from '../components/agenda-filters.js';
import { dateKey, startOfWeek, addDays } from '../utils/date.utils.js';

export { dateKey };

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
    customer_id:row.customer_id,service_id:row.service_id,
    date:start.date,time:start.time,duration,price:row.price,
    status:dbStatus(row.status),dbStatus:row.status,notes:row.notes||'',
    booking_source:row.booking_source,created_by_name:row.created_by_name||'',
    service_order_id:row.service_order_id,arrived_at:row.arrived_at||null
  };
}
// Compõe filtros, resumo e calendário sem executar consultas ao banco.
function buildContent() {
  const host=document.querySelector('#agenda-db-content');
  if(!host)return;
  const professionals=state.agendaProfessionals||[];
  if(!professionals.length){
    host.innerHTML='<div class="empty-state"><b>Nenhum profissional ativo</b><small>Cadastre um profissional para começar a organizar a agenda.</small></div>';
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
  html+='<div class="agenda-summary"><span><i class="legend-dot booked"></i> Agendado</span><span><i class="legend-dot progress"></i> Em atendimento</span><span><i class="legend-dot free"></i> Disponível</span><span class="summary-count">'+count+' atendimento(s) para '+selectedProfessional[1]+'</span></div>';
  const props={date:state.date,pro:state.pro,professional:selectedProfessional,appointments:items,
    blockedTimes:state.dbBlockedTimes||[],includeReleased:state.filter==='Cancelado'||state.filter==='Falta'};
  html+=state.view==='Dia'?renderDayCalendar(props):state.view==='Semana'?renderWeekCalendar(props):renderMonthCalendar(props);
  html+='<div class="agenda-help">Selecione um atendimento para confirmar, reagendar, registrar chegada, abrir uma comanda ou cancelar. Alterações são registradas no banco e na auditoria.</div>';
  host.innerHTML=html;
}
export function agenda() {
  return head('Agenda','Gerencie horários, atendimentos e disponibilidade dos profissionais.',btn('＋ Novo agendamento','new-appointment','primary'))+
    '<div id="agenda-db-content"><div class="empty-state">Carregando agenda do banco…</div></div>';
}
// Consulta profissionais, agendamentos e bloqueios da organização ativa.
export async function loadAgendaPage() {
  if(!state.user||!state.organization?.id)return;
  const host=document.querySelector('#agenda-db-content');
  if(!host)return;
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
    const [proResult,appointmentResult,blockResult]=await Promise.all([
      supabase.from('professionals').select('id,name,color,active').eq('org_id',state.organization.id).eq('active',true).order('name'),
      supabase.from('appointments').select('id,customer_id,professional_id,customer_name,customer_phone,service_id,service_name,professional_name,starts_at,ends_at,status,price,booking_source,created_by_name,notes,service_order_id,arrived_at').eq('org_id',state.organization.id).gte('starts_at',start.toISOString()).lt('starts_at',end.toISOString()).order('starts_at').limit(1000),
      supabase.from('appointment_blocks').select('id,professional_id,starts_at,ends_at,reason').eq('org_id',state.organization.id).lt('starts_at',end.toISOString()).gt('ends_at',start.toISOString()).limit(500)
    ]);
    if(proResult.error)throw proResult.error;
    if(appointmentResult.error)throw appointmentResult.error;
    if(blockResult.error)throw blockResult.error;
    const dbProfessionals=proResult.data||[];
    state.agendaProfessionals=dbProfessionals.map(p=>[initials(p.name||'?'),p.name,'Profissional',p.id]);
    if(!state.agendaProfessionals.length){state.agendaAppointments=[];state.dbBlockedTimes=[];buildContent();return;}
    const indexById=new Map(dbProfessionals.map((p,i)=>[p.id,i]));
    state.agendaAppointments=(appointmentResult.data||[]).filter(a=>indexById.has(a.professional_id)).map(a=>toCalendarAppointment(a,indexById.get(a.professional_id)));
    state.dbBlockedTimes=(blockResult.data||[]).flatMap(b=>{
      const startDate=asLocalDateTime(b.starts_at),endDate=asLocalDateTime(b.ends_at);
      const indices=b.professional_id?[indexById.get(b.professional_id)].filter(i=>i!==undefined):dbProfessionals.map((_,i)=>i);
      return indices.map(index=>({id:b.id,pro:index,date:startDate.date,start:startDate.time,end:endDate.time,reason:b.reason}));
    });
    buildContent();
  }catch(error){
    host.innerHTML='<div class="empty-state"><b>Não foi possível carregar a agenda.</b><small>'+String(error.message||'Verifique sua conexão e permissões.')+'</small></div>';
  }
}
export function refreshAgendaContent(){buildContent();}
export function findAppointmentView(id){return (state.agendaAppointments||[]).find(a=>String(a.id)===String(id))||null;}
