import {dateKey} from '../utils/date.utils.js';
import {timeToMinutes} from '../utils/duration.utils.js';
import {renderAppointmentCard} from './appointment-card.js';
import {renderTimeSlot} from './time-slot.js';
export function renderDayCalendar({date,pro,professional,appointments,blockedTimes=[]}){
 const key=dateKey(date),times=Array.from({length:25},(_,i)=>String(Math.floor(i/2)+8).padStart(2,'0')+':'+(i%2?'30':'00'));
 return '<section class="calendar surface"><div class="calendar-header"><div class="time-heading">HORÁRIO</div><div>'+professional[1]+' <small>'+professional[2]+'</small></div><div class="availability-heading">DISPONIBILIDADE</div></div><div class="calendar-body"><div class="time-column">'+times.map(t=>'<div class="time-cell">'+t+'</div>').join('')+'</div><div class="schedule-column">'+times.map(t=>{
 const minute=timeToMinutes(t),a=appointments.find(x=>x.date===key&&x.pro===pro&&x.time===t),occupied=appointments.some(x=>x.date===key&&x.pro===pro&&timeToMinutes(x.time)<=minute&&timeToMinutes(x.time)+Number(x.duration)>minute),blocked=blockedTimes.find(x=>x.date===key&&x.pro===pro&&timeToMinutes(x.start)<=minute&&timeToMinutes(x.end)>minute);
 return a?renderTimeSlot(t,key,pro,renderAppointmentCard(a)):occupied?'<div class="schedule-slot occupied-slot" aria-hidden="true"></div>':blocked?'<div class="schedule-slot blocked-slot" title="'+blocked.reason+'"><span>Bloqueado · '+blocked.reason+'</span></div>':renderTimeSlot(t,key,pro);
 }).join('')+'</div><div class="availability-column">'+times.map(t=>'<div class="availability-cell"><span>Disponível</span><button data-new-slot="'+t+'" data-new-date="'+key+'" aria-label="Agendar às '+t+'">＋</button></div>').join('')+'</div></div></section>';
}
