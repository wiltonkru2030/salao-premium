/** Composição visual da Agenda, sem rede ou manipulação de DOM. */
import {salonTimezone} from "../utils/salon-time.js";
import {formatSavedPhone} from "../../src/utils/input-masks.js";
import {escapeHtml as esc,formatMoney as money,toDateKey as dateKey,formatMonthLabel as monthLabel,formatDateLabel as dateLabel,formatTime as timeLabel,formatBookingSource as sourceLabel,formatStatus as statusLabel,getAppointmentClass as appointmentClass} from "../utils/formatters.js";
import {renderAttendanceActions} from "../attendance.service.js";
import {renderProfessionalBooking} from "./booking.views.js";
import {renderAgendaView} from "./agenda.views.js";
/** Cria renderizadores da Agenda com estado e flags injetados. */
export function createAgendaWorkspaceViews({state,attendanceEnabled,appointmentStatusEnabled,rescheduleEnabled,bookingEnabled,unitBookingEnabled,customerRegistrationEnabled}){
 function appointmentCard(a){
  const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
  return '<button type="button" class="appointment sp-content-surface '+appointmentClass(a)+'" data-appointment="'+esc(a.id)+'"><span class="professional-appointment-heading"><time datetime="'+esc(a.starts_at)+'">'+timeLabel(a.starts_at,salonTimezone(state.organization?.timezone))+'</time><strong>'+esc(a.customer_name)+'</strong></span>'+
  '<div class="meta">'+esc(a.service_name)+' · '+timeLabel(a.ends_at,salonTimezone(state.organization?.timezone))+'<br>'+esc(formatSavedPhone(a.customer_phone)||"Telefone não informado")+' · '+money(a.price)+'<br>'+esc(a.professional_name||state.professional?.name||"Profissional")+' · '+duration+' min</div>'+
  '<span class="tag">'+esc(statusLabel(a.status))+' · Agendado por: '+esc(sourceLabel(a.booking_source))+'</span>'+((appointmentStatusActions(a)||renderAttendanceActions(state,a,attendanceEnabled))?'<small class="meta">Toque para ver as ações</small>':'')+'</button>';
 }
 /** Exibe ações de status somente para o agendamento individual elegível. */
 function appointmentStatusActions(appointment) {
  if(state.role!=="professional" || appointment.professional_id!==state.professional?.id ||
    appointment.appointment_group_id || appointment.service_order_id ||
    !["scheduled","confirmed"].includes(appointment.status))return "";
  const statusButtons=appointmentStatusEnabled?'<div class="professional-card-actions">'+
    (appointment.status==="scheduled"?'<button type="button" class="secondary" data-own-appointment-status="confirmed">Confirmar</button>':'')+
    '<button type="button" class="secondary" data-own-appointment-status="cancelled">Cancelar agendamento</button></div>':"";
  const rescheduleForm=rescheduleEnabled&&appointment.branch_id
    ? '<details><summary>Reagendar</summary><form id="professional-reschedule"><label class="field">Novo horário · '+esc(state.organization?.timezone||"Fuso do salão")+'<input name="local_start" type="datetime-local" required></label><button type="submit" class="secondary">Salvar novo horário</button></form></details>'
    : "";
  return statusButtons+rescheduleForm;
 }
 
 /** Renderiza os dados do agendamento selecionado e as ações disponíveis. */
 function appointmentDetails(){
  const a=state.selectedAppointment;if(!a)return "";
  const duration=Math.max(0,Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000));
  return '<section class="detail sp-content-surface"><div class="section-title"><h2>Detalhes do agendamento</h2><button class="secondary" data-action="close-appointment">Fechar</button></div>'+
  '<div class="detail-row"><span>Cliente</span><b>'+esc(a.customer_name)+'</b></div>'+
  '<div class="detail-row"><span>Telefone</span><b>'+esc(formatSavedPhone(a.customer_phone)||"—")+'</b></div>'+
  '<div class="detail-row"><span>Serviço</span><b>'+esc(a.service_name)+'</b></div>'+
  '<div class="detail-row"><span>Profissional</span><b>'+esc(a.professional_name||state.professional?.name||"—")+'</b></div>'+
  '<div class="detail-row"><span>Data</span><b>'+new Date(a.starts_at).toLocaleDateString("pt-BR",{timeZone:salonTimezone(state.organization?.timezone)})+'</b></div>'+
  '<div class="detail-row"><span>Horário</span><b>'+timeLabel(a.starts_at,salonTimezone(state.organization?.timezone))+'–'+timeLabel(a.ends_at,salonTimezone(state.organization?.timezone))+'</b></div>'+
  '<div class="detail-row"><span>Duração</span><b>'+duration+' minutos</b></div>'+
  '<div class="detail-row"><span>Valor previsto</span><b>'+money(a.price)+'</b></div>'+
  '<div class="detail-row"><span>Status</span><b>'+esc(statusLabel(a.status))+'</b></div>'+
  '<div class="detail-row"><span>Origem</span><b>'+esc(sourceLabel(a.booking_source))+'</b></div>'+
  '<div class="detail-row"><span>Quem criou</span><b>'+esc(a.created_by_name||sourceLabel(a.booking_source))+'</b></div>'+
  '<div class="detail-row"><span>Observações</span><b>'+esc(a.notes||"—")+'</b></div>'+appointmentStatusActions(a)+renderAttendanceActions(state,a,attendanceEnabled)+'</section>';
 }
 // Apresenta calendário mensal e lista de agendamentos do profissional.
 // Delega a composição visual da agenda para uma view sem efeitos colaterais.
 function agendaView(){
  const booking=bookingEnabled&&state.role==="professional"&&state.professional
   ?renderProfessionalBooking({unitBooking:unitBookingEnabled&&customerRegistrationEnabled&&!!state.professional.branch_id})
   :"";
  return renderAgendaView({state,dateKey,monthLabel,dateLabel,appointmentCard,appointmentDetails,booking});
 }
 return {agendaView,appointmentStatusActions};
}
