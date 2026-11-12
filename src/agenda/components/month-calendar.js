import {dateKey} from '../utils/date.utils.js';
export function renderMonthCalendar({date,pro,appointments,blockedTimes=[]}){
 const first=new Date(date.getFullYear(),date.getMonth(),1),offset=(first.getDay()+6)%7,days=new Date(date.getFullYear(),date.getMonth()+1,0).getDate(),cells=Math.ceil((offset+days)/7)*7;
 return '<section class="month-calendar surface"><div class="month-weekdays">'+['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="month-grid">'+Array.from({length:cells},(_,i)=>{
  const n=i-offset+1;if(n<1||n>days)return '<div class="month-empty"></div>';
  const d=new Date(date.getFullYear(),date.getMonth(),n),key=dateKey(d),list=appointments.filter(a=>a.pro===pro&&a.date===key),blocks=blockedTimes.filter(b=>b.pro===pro&&b.date===key);
  return '<button class="month-day" data-select-date="'+key+'" data-month-date="'+key+'"><b>'+n+'</b><small>'+list.length+' atendimento(s)</small>'+list.slice(0,2).map(a=>'<small>'+a.time+' · '+a.name+'</small>').join('')+(blocks.length?'<small class="month-blocked">'+blocks.length+' bloqueio(s)</small>':'')+'</button>';
 }).join('')+'</div></section>';
}
