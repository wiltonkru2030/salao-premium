/** Componente: cartão de agendamento. Responsabilidade: exibir cliente, serviço, duração e status em uma faixa do calendário. */
import {esc} from '../../utils.js';
export function renderAppointmentCard(a,compact=false){
 const unit=compact?64:52,height=Math.max(44,Math.round(Number(a.duration||30)/30*unit-8));
 return '<button type="button" class="'+(compact?'week-appointment':'appointment-block')+
' '+(a.status==='Em atendimento'?'in-progress':'')+
'" style="height:'+height+
'px;min-height:40px;z-index:2;position:relative" draggable="true" data-appointment="'+a.id+
'" aria-label="'+esc(a.name)+
', '+esc(a.time)+
', '+esc(a.service)+
'"><span class="appointment-time">'+esc(a.time)+
' · '+Number(a.duration||0)+
' min</span><b>'+esc(a.name)+
'</b><small>'+esc(a.service)+
'</small><span class="appointment-status">'+esc(a.status)+
'</span></button>';
}
