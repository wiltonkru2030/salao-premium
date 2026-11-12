import {state} from '../state.js';
import {pros,appts} from '../data/index.js';
import {head,btn} from '../utils.js';
import {renderProfessionalSelector} from '../agenda/components/professional-selector.js';
import {renderAgendaToolbar} from '../agenda/components/agenda-toolbar.js';
import {renderDayCalendar} from '../agenda/components/day-calendar.js';
import {renderWeekCalendar} from '../agenda/components/week-calendar.js';
import {renderMonthCalendar} from '../agenda/components/month-calendar.js';
import {dateKey} from '../agenda/utils/date.utils.js';
import {renderAgendaFilters} from '../agenda/components/agenda-filters.js';
export function professionals(){return renderProfessionalSelector(state.pro)}
export {dateKey};
export function agenda(){const date=dateKey(state.date),items=appts.filter(a=>a.pro===state.pro);let html=head('Agenda','Uma visão clara dos horários, profissionais e atendimentos.',btn('＋ Novo agendamento','new-appointment','primary'));html+=professionals()+renderAgendaToolbar(state.date,state.view)+renderAgendaFilters();html+='<div class="agenda-summary"><span><i class="legend-dot booked"></i> Agendado</span><span><i class="legend-dot progress"></i> Em atendimento</span><span><i class="legend-dot free"></i> Disponível</span><span class="summary-count">'+items.filter(a=>a.date===date).length+' atendimentos para '+pros[state.pro][1]+'</span></div>';const props={date:state.date,pro:state.pro,professional:pros[state.pro],appointments:items};html+=state.view==='Dia'?renderDayCalendar(props):state.view==='Semana'?renderWeekCalendar(props):renderMonthCalendar(props);html+='<div class="agenda-help">Selecione um atendimento para consultar os detalhes. Arraste no computador para pré-visualizar uma mudança de horário; a validação final será feita pela API.</div><p class="demo-note">Modo de demonstração: alterações são temporárias e não são gravadas no banco de dados.</p>';return html}
