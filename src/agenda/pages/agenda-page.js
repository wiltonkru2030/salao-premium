import {state} from '../../state.js';
import {pros,appts} from '../../data/index.js';
import {head,btn} from '../../utils.js';
import {renderProfessionalSelector} from '../components/professional-selector.js';
import {renderAgendaToolbar} from '../components/agenda-toolbar.js';
import {renderDayCalendar} from '../components/day-calendar.js';
import {renderWeekCalendar} from '../components/week-calendar.js';
import {renderMonthCalendar} from '../components/month-calendar.js';
import {dateKey} from '../utils/date.utils.js';
import {renderAgendaFilters} from '../components/agenda-filters.js';
export function professionals(){return renderProfessionalSelector(state.pro)}
export {dateKey};
export function agenda(){
 const date=dateKey(state.date);
 const query=String(state.query||'').trim().toLocaleLowerCase('pt-BR');
 const items=appts.filter(a=>a.pro===state.pro&&(!state.filter||state.filter==='Todos'||a.status===state.filter)&&(!query||[a.name,a.service,a.phone].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query))));
 const count=items.filter(a=>a.date===date).length;
 let html=head('Agenda','Gerencie horários, atendimentos e disponibilidade dos profissionais.',btn('＋ Novo agendamento','new-appointment','primary'));
 html+=professionals()+renderAgendaToolbar(state.date,state.view)+renderAgendaFilters({query:state.query,filter:state.filter});
 html+='<div class="agenda-summary"><span><i class="legend-dot booked"></i> Agendado</span><span><i class="legend-dot progress"></i> Em atendimento</span><span><i class="legend-dot free"></i> Disponível</span><span class="summary-count">'+count+' atendimento(s) para '+pros[state.pro][1]+'</span></div>';
 const props={date:state.date,pro:state.pro,professional:pros[state.pro],appointments:items,blockedTimes:state.blockedTimes||[]};
 html+=state.view==='Dia'?renderDayCalendar(props):state.view==='Semana'?renderWeekCalendar(props):renderMonthCalendar(props);
 html+='<div class="agenda-help">Selecione um atendimento para consultar ou editar. No computador, arraste um cartão para pré-visualizar a mudança de horário.</div><p class="demo-note">Demonstração local: criações, edições e bloqueios ficam somente nesta sessão e não são salvos no banco.</p>';
 return html;
}
