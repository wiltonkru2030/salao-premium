/** Componente: calendário semanal. Responsabilidade: distribuir dias e agendamentos na grade da semana. */
import {startOfWeek,addDays,dateKey} from '../utils/date.utils.js';
import {timeToMinutes} from '../utils/duration.utils.js';
import {renderAppointmentCard} from './appointment-card.js';
import {esc} from '../../utils.js';
export function renderWeekCalendar({date,pro,appointments,blockedTimes=[],includeReleased=false}){
 const first=startOfWeek(date),times=Array.from({length:24},(_,i)=>String(Math.floor(i/2)+8).padStart(2,'0')+':'+(i%2?'30':'00'));
 return '<section class="week-calendar surface"><div class="week-grid">'+Array.from({length:7},(_,i)=>{
 const d=addDays(first,i),key=dateKey(d);
 return '<div class="week-day"><div class="week-day-head"><b>'+esc(d.toLocaleDateString('pt-BR',{weekday:'short'}))+'</b><small>'+d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+'</small></div>'+times.map(t=>{
 const minute=timeToMinutes(t),a=appointments.find(x=>x.pro===pro&&x.date===key&&x.time===t&&(includeReleased||!['Cancelado','Falta'].includes(x.status))),occupied=appointments.some(x=>!['Cancelado','Falta'].includes(x.status)&&x.pro===pro&&x.date===key&&timeToMinutes(x.time)<=minute&&timeToMinutes(x.time)+Number(x.duration)>minute),blocked=blockedTimes.find(x=>x.pro===pro&&x.date===key&&timeToMinutes(x.start)<=minute&&timeToMinutes(x.end)>minute);
 return '<div class="week-slot" data-slot="'+t+'" data-date="'+key+'" data-pro="'+pro+'">'+(a?renderAppointmentCard(a,true):occupied?'<span class="occupied-slot" aria-hidden="true"></span>':blocked?'<span class="week-blocked" title="'+esc(blocked.reason)+'">Bloqueado <button type="button" data-remove-block="'+blocked.id+'" aria-label="Remover bloqueio">×</button></span>':'<button class="week-empty" data-new-slot="'+t+'" data-new-date="'+key+'">＋</button>')+'</div>';
 }).join('')+'</div>';
 }).join('')+'</div></section>';
}
