/** Navega por ID opaco de aviso, nunca por dados pessoais recebidos do push. */
import {salonCalendarDate,salonTimezone} from "../utils/salon-time.js";
const validId=value=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** Lê somente UUID, rejeita entradas externas ou malformadas. */
export function readNotificationLink(url){
 try{const id=new URL(url).searchParams.get("notification");return validId(id)?id:null;}catch{return null;}
}
/** Resolve o destino após verificar contexto e RLS; evita respostas de sessão antiga. */
export function createNotificationNavigation({state,getEpoch,fetchAppointment,fetchInbox,loadAppointments,render,showNotice}){
 let sequence=0;
 async function open(id){
  if(!validId(id)||state.role!=="professional"||!state.orgId||!state.branchId||!state.professional?.id)return false;
  const epoch=getEpoch(),request=++sequence,current=()=>getEpoch()===epoch&&sequence===request;
  try{
   const inbox=await fetchInbox(state.orgId);
   if(!current())return false;
   const item=inbox.items.find(row=>row.id===id);
   if(!item||!item.appointment_id){showNotice("Aviso sem agendamento disponível. Consulte suas notificações.");return false;}
   const appointment=await fetchAppointment({organizationId:state.orgId,professionalId:state.professional.id,branchId:state.branchId,appointmentId:item.appointment_id});
   if(!current())return false;
   if(!appointment){showNotice("Agendamento indisponível nesta unidade ou sem acesso. Confira a unidade selecionada.");return false;}
   const date=salonCalendarDate(appointment.starts_at,salonTimezone(state.organization?.timezone));
   Object.assign(state,{page:"Agenda",selectedDate:date,month:new Date(date.getFullYear(),date.getMonth(),1),selectedAppointment:null,appointmentModalMode:null,notice:""});
   await loadAppointments();
   if(!current()||state.page!=="Agenda")return false;
   const refreshed=state.appointments.find(row=>row.id===appointment.id);
   if(!refreshed){showNotice("Agendamento não encontrado na Agenda. Atualize e tente novamente.");return false;}
   state.selectedAppointment=refreshed;state.appointmentModalMode="details";render();return true;
  }catch{if(current())showNotice("Não foi possível abrir o aviso. Tente novamente.");return false;}
 }
 return {open};
}
