/**
 * SALÃO PREMIUM — view da agenda do App Profissional.
 * Responsabilidade: renderizar calendário mensal e compromissos do dia sem acessar DOM ou rede.
 * Integração: recebe estado e formatadores pelo controlador professional/app.js.
 */

/**
 * Renderiza a agenda mensal e os compromissos do dia selecionado.
 * @param {object} context Estado, formatadores e renderizadores auxiliares da tela.
 * @returns {string} Markup do calendário e da lista de agendamentos.
 */
export function renderAgendaView(context) {
  const { state, dateKey, monthLabel, dateLabel, appointmentCard, appointmentDetails } = context;
  const year=state.month.getFullYear(),month=state.month.getMonth(),first=new Date(year,month,1),offset=first.getDay(),days=new Date(year,month+1,0).getDate(),prevDays=new Date(year,month,0).getDate();
   const marks=new Set(state.appointments.map(a=>dateKey(new Date(a.starts_at))));
   const cells=[];
   for(let i=0;i<42;i++){
    let d,inside=true;
    if(i<offset){d=new Date(year,month-1,prevDays-offset+i+1);inside=false;}
    else if(i>=offset+days){d=new Date(year,month+1,i-offset-days+1);inside=false;}
    else d=new Date(year,month,i-offset+1);
    const key=dateKey(d),classes=[inside?"":"outside",key===dateKey(state.selectedDate)?"selected":"",key===dateKey(new Date())?"today":""].join(" ");
    cells.push('<button class="day '+classes+'" data-date="'+key+'">'+d.getDate()+(marks.has(key)?'<i class="dot"></i>':'')+'</button>');
   }
   const selected=state.appointments.filter(a=>dateKey(new Date(a.starts_at))===dateKey(state.selectedDate)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
   return '<div class="section-title"><h2>Agenda mensal</h2><span class="muted">'+(state.scope==="calendar_all"||state.scope==="all"?"Agenda completa autorizada":"Somente sua agenda")+'</span></div>'+
   '<div class="calendar-head"><button data-action="prev-month">‹</button><strong>'+esc(monthLabel(state.month))+'</strong><button data-action="next-month">›</button></div>'+
   '<div class="calendar">'+["D","S","T","Q","Q","S","S"].map(d=>'<div class="weekday">'+d+'</div>').join("")+cells.join("")+'</div>'+
   '<div class="section-title section-title--tight-spaced"><h2>'+esc(dateLabel(state.selectedDate))+'</h2><span class="muted">'+selected.length+' agendamento(s)</span></div>'+
   (selected.length?selected.map(appointmentCard).join(""):'<div class="empty">Nenhum agendamento neste dia.</div>')+appointmentDetails();
}
