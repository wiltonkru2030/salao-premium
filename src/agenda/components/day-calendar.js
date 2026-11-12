/** Componente: calendário diário. Responsabilidade: distribuir horários, agendamentos e bloqueios na grade de um dia. */
import {dateKey} from '../utils/date.utils.js';
import {timeToMinutes} from '../utils/duration.utils.js';
import {renderAppointmentCard} from './appointment-card.js';
import {renderTimeSlot} from './time-slot.js';
import {esc} from '../../utils.js';
export function renderDayCalendar({date,pro,professional,appointments,blockedTimes=[],includeReleased=false}){
 const key=dateKey(date),times=Array.from({length:24},(_,i)=>String(Math.floor(i/2)+8).padStart(2,'0')+':'+(i%2?'30':'00'));
 return '<section class="calendar surface"><div class="calendar-header"><div class="time-heading">HORÁRIO</div><div>'+esc(professional[1])+' <small>'+esc(professional[2])+'</small></div><div class="availability-heading">DISPONIBILIDADE</div></div><div class="calendar-body"><div class="time-column">'+times.map(t=>'<div class="time-cell">'+t+'</div>').join('')+'</div><div class="schedule-column">'+times.map(t=>{
 const minute=timeToMinutes(t),a=appointments.find(x=>x.date===key&&x.pro===pro&&x.time===t&&(includeReleased||!['Cancelado','Falta'].includes(x.status))),occupied=appointments.some(x=>!['Cancelado','Falta'].includes(x.status)&&x.date===key&&x.pro===pro&&timeToMinutes(x.time)<=minute&&timeToMinutes(x.time)+Number(x.duration)>minute),blocked=blockedTimes.find(x=>x.date===key&&x.pro===pro&&timeToMinutes(x.start)<=minute&&timeToMinutes(x.end)>minute);
 return a?renderTimeSlot(t,key,pro,renderAppointmentCard(a)):occupied?'<div class="schedule-slot occupied-slot" aria-hidden="true"></div>':blocked?'<div class="schedule-slot blocked-slot" title="'+esc(blocked.reason)+'"><span>Bloqueado · '+esc(blocked.reason)+'</span><button type="button" class="remove-block" data-remove-block="'+blocked.id+'" aria-label="Remover bloqueio">×</button></div>':renderTimeSlot(t,key,pro);
 }).join('')+'</div><div class="availability-column">'+times.map(t=>{const minute=timeToMinutes(t),busy=appointments.some(x=>!['Cancelado','Falta'].includes(x.status)&&x.date===key&&x.pro===pro&&timeToMinutes(x.time)<=minute&&timeToMinutes(x.time)+Number(x.duration)>minute),blocked=blockedTimes.some(x=>x.date===key&&x.pro===pro&&timeToMinutes(x.start)<=minute&&timeToMinutes(x.end)>minute);return '<div class="availability-cell"><span>'+(blocked?'Bloqueado':busy?'Ocupado':'Disponível')+'</span>'+(blocked||busy?'':'<button data-new-slot="'+t+'" data-new-date="'+key+'" aria-label="Agendar às '+t+'">＋</button>')+'</div>'}).join('')+'</div></div></section>';
}
