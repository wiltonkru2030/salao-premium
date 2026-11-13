/** Componente: barra de ferramentas da Agenda. Responsabilidade: navegação de período, visualização e bloqueio de horário. */
import {formatDate} from '../utils/date.utils.js';
export function renderAgendaToolbar(date,view){return '<div class="agenda-toolbar"><div class="date-controls"><button class="icon-btn" data-action="prev" aria-label="Período anterior">‹</button><button class="btn secondary" data-action="today">Hoje</button><button class="icon-btn" data-action="next" aria-label="Próximo período">›</button><b>'+formatDate(date)+
'</b></div><div class="toolbar-right"><select class="field compact" data-view aria-label="Visualização da agenda"><option '+(view==='Dia'?'selected':'')+
'>Dia</option><option '+(view==='Semana'?'selected':'')+
'>Semana</option><option '+(view==='Mês'?'selected':'')+
'>Mês</option></select><button class="btn" data-action="block-time">＋ Bloquear horário</button></div></div>'}
