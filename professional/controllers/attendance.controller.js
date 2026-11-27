import {canUseSelectedUnit,selectedUnitArgs} from "../unit-context.js";
/** Agenda e Atendimento: coordena mutações sem acessar sessão global. */
import {updateOwnAppointmentStatus,rescheduleOwnAppointment,createOwnAppointment,createUnitAppointment} from "../appointments.service.js";
import {attendanceActions,performAttendanceAction} from "../attendance.service.js";
import {salonCalendarDate} from "../utils/salon-time.js";
import {toDateKey as dateKey} from "../utils/formatters.js";

/** Recebe dependências de interface e sessão; bloqueios de operações são isolados por geração. */
export function createAttendanceController({state,supabase,getEpoch,showNotice,loadAppointments,loadOrders,chooseOrder,appointmentStatusActions,appointmentStatusEnabled,attendanceEnabled,rescheduleEnabled,bookingEnabled,unitBookingEnabled,customerRegistrationEnabled}){
 let pendingEpoch=null;
 async function applyAppointmentStatus(control) {
  const appointment=state.selectedAppointment;
  if(!appointmentStatusEnabled || !appointment || pendingEpoch===getEpoch() || !appointmentStatusActions(appointment))return;
  const status=control.dataset.ownAppointmentStatus;
  if(status==="cancelled"&&!window.confirm("Cancelar este agendamento?"))return;
  const epoch=getEpoch();
  pendingEpoch=epoch;
  control.disabled=true;
  try {
   const saved=await updateOwnAppointmentStatus({client:supabase,organizationId:state.orgId,appointmentId:appointment.id,status});
   if(epoch!==getEpoch())return;
   state.appointments=state.appointments.map(item=>item.id===saved.id?{...item,...saved}:item);
   if(state.selectedAppointment?.id===saved.id)state.selectedAppointment={...appointment,...saved};
   showNotice(status==="confirmed"?"Agendamento confirmado.":"Agendamento cancelado.");
  } catch(error) {
   if(epoch===getEpoch())showNotice(error.message);
  } finally {
   if(pendingEpoch===epoch)pendingEpoch=null;
   if(control.isConnected)control.disabled=false;
  }
 }
 
 /** Atualiza Agenda e Comandas após confirmação do servidor, sem registrar pagamentos. */
 async function applyAttendance(control){
  const appointment=state.selectedAppointment,operation=control.dataset.attendanceAction;
  if(!attendanceEnabled||state.page!=="Agenda"||pendingEpoch===getEpoch()||!attendanceActions(state,appointment).includes(operation))return;
  if(operation==="finish"&&!window.confirm("Finalizar o atendimento e encaminhar a comanda ao Caixa?"))return;
  const epoch=getEpoch();
  pendingEpoch=epoch;control.disabled=true;
  try{
   const saved=await performAttendanceAction({client:supabase,organizationId:state.orgId,appointmentId:appointment.id,operation,...selectedUnitArgs(state)});
   if(epoch!==getEpoch())return;
   const patch={status:saved.status,service_order_id:saved.order_id};
   state.appointments=state.appointments.map(item=>item.id===appointment.id?{...item,...patch}:item);
   if(state.selectedAppointment?.id===appointment.id)state.selectedAppointment={...state.selectedAppointment,...patch};
   const message=operation==="start"?"Atendimento iniciado. Abra a comanda para registrar outros serviços.":"Atendimento concluído. Comanda encaminhada ao Caixa.";
   try{await loadOrders();if(epoch===getEpoch())showNotice(message);}
   catch(error){if(epoch===getEpoch())showNotice(message+" Atualize Comandas para consultar os itens.");}
  }catch(error){if(epoch===getEpoch())showNotice(error.message);}
  finally{if(pendingEpoch===epoch)pendingEpoch=null;if(control.isConnected)control.disabled=false;}
 }
 /** Abre a comanda vinculada somente se estiver visível no contexto autorizado. */
 async function openAttendanceOrder(){
  const appointment=state.selectedAppointment,epoch=getEpoch();
  if(!attendanceEnabled||!appointment?.service_order_id||state.page!=="Agenda"||!attendanceActions(state,appointment).includes("order"))return;
  try{
   await loadOrders();
   if(epoch!==getEpoch()||state.page!=="Agenda"||state.selectedAppointment?.id!==appointment.id)return;
   if(!state.orders.some(order=>order.id===appointment.service_order_id)){showNotice("Comanda não encontrada na lista recente. Consulte a recepção.");return;}
   state.page="Comandas";state.selectedAppointment=null;state.notice="";
   await chooseOrder(appointment.service_order_id);
  }catch(error){if(epoch===getEpoch())showNotice("Não foi possível carregar a comanda. Tente novamente.");}
 }
 
 async function applyAppointmentReschedule(form) {
  const appointment=state.selectedAppointment;
  if(!rescheduleEnabled||!appointment?.branch_id||pendingEpoch===getEpoch()||!appointmentStatusActions(appointment))return;
  const localStart=new FormData(form).get("local_start");
  const button=form.querySelector("button[type=submit]");
  const epoch=getEpoch();
  pendingEpoch=epoch;
  button.disabled=true;
  try {
   const saved=await rescheduleOwnAppointment({client:supabase,organizationId:state.orgId,appointment,localStart});
   if(epoch!==getEpoch())return;
   const newDate=salonCalendarDate(saved.starts_at,state.organization?.timezone);
   if(state.page==="Agenda"&&state.selectedAppointment?.id===saved.id) {
    state.selectedDate=newDate;
    state.month=new Date(newDate.getFullYear(),newDate.getMonth(),1);
    state.selectedAppointment={...appointment,...saved};
   }
   state.appointments=state.appointments.filter(item=>item.id!==saved.id);
   try {
    await loadAppointments();
    if(epoch===getEpoch())showNotice("Agendamento reagendado.");
   } catch {
    if(epoch===getEpoch())showNotice("Agendamento reagendado. Atualize a Agenda para recarregar os horários.");
   }
  } catch(error) {
   if(epoch===getEpoch())showNotice(error.message);
  } finally {
   if(pendingEpoch===epoch)pendingEpoch=null;
   if(button.isConnected)button.disabled=false;
  }
 }
 
 /** Salva o novo horário e recarrega a agenda do mês em que ele foi criado. */
 async function applyNewAppointment(form) {
  if(!bookingEnabled||state.role!=="professional"||state.page!=="Agenda"||pendingEpoch===getEpoch())return;
  const reference=form.querySelector("[data-booking-client]").dataset.selectedId;
  const service=form.querySelector("[data-booking-service]").dataset.selectedId;
  const hour=new FormData(form).get("start");
  const feedback=form.querySelector("[data-booking-error]");
  if(!reference||!service||!/^\d{2}:\d{2}$/.test(hour||"")){
   feedback.textContent=!reference?"Toque no nome da cliente na lista de sugestões.":!service?"Toque no serviço na lista de sugestões.":"Informe a hora do atendimento.";
   feedback.hidden=false;
   return;
  }
  feedback.hidden=true;
  const epoch=getEpoch(),button=form.querySelector("button[type=submit]");
  const localStart=dateKey(state.selectedDate)+"T"+hour;
  pendingEpoch=epoch;
  button.disabled=true;
  try {
   const unitBooking=unitBookingEnabled&&customerRegistrationEnabled&&canUseSelectedUnit(state)&&form.dataset.unitBooking==="true";
   const options={client:supabase,organizationId:state.orgId,reference,service,localStart};
   const saved=await (unitBooking?createUnitAppointment({...options,customerId:reference,...selectedUnitArgs(state)}):createOwnAppointment(options));
   if(epoch!==getEpoch())return;
   if(state.page==="Agenda") {
    const date=salonCalendarDate(saved.starts_at,state.organization?.timezone);
    state.selectedDate=date;
    state.month=new Date(date.getFullYear(),date.getMonth(),1);
    state.selectedAppointment=null;
   }
   try {
    await loadAppointments();
    if(epoch===getEpoch())showNotice("Agendamento criado.");
   } catch {
    if(epoch===getEpoch())showNotice("Agendamento criado. Atualize a Agenda para ver o horário.");
   }
  } catch(error) {
   if(epoch===getEpoch()&&form.isConnected){
    feedback.textContent=error.message;
    feedback.hidden=false;
   }
  } finally {
   if(pendingEpoch===epoch)pendingEpoch=null;
   if(button.isConnected)button.disabled=false;
  }
 }
 return {applyAppointmentStatus,applyAttendance,openAttendanceOrder,applyAppointmentReschedule,applyNewAppointment};
}
