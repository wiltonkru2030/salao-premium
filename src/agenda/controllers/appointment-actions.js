/**
 * Casos de uso da Agenda: validação, gravação e integração com Comanda.
 * Funções recebem o estado autenticado e executam operações persistentes com org_id.
 */
import { state } from "../../state.js";
import { $, toast } from "../../utils.js";
import { parseBRL } from "../../utils/input-masks.js";
import { reportError } from "../../utils/errors.js";
import { render } from "../../layout/render.js";
import { appointmentDrawer, renderDrawer, openDrawer } from "../../components/drawer.js";
import { supabase } from "../../supabase/client.js";
import { loadAgendaPage, refreshAgendaContent, findAppointmentView } from "../pages/agenda-page.js";
import { dateKey, addDays } from "../utils/date.utils.js";

// Conversores de data/horário usados pelos formulários da Agenda.
export function dateFromKey(key) {
  const parts=String(key).split('-').map(Number);
  return new Date(parts[0],parts[1]-1,parts[2]);
}
export function makeTimestamp(date,time) {
  const value=new Date(String(date)+'T'+String(time)+':00');
  if(Number.isNaN(value.getTime())) throw new Error('Data ou horário inválido.');
  return value;
}
function durationBetween(start,end) {
  return Math.max(5,Math.round((end.getTime()-start.getTime())/60000));
}
export function appointmentActionRow() {
  return state.drawer?.appointment || null;
}
// Atualiza calendário e painel de detalhes após uma mutação.
async function refreshAgendaAndDrawer() {
  await loadAgendaPage();
  if(state.drawer?.appointment) {
    const current=findAppointmentView(state.drawer.appointment.id);
    state.drawer=current?{...state.drawer,appointment:current}:null;
    renderDrawer();
  }
}
// Busca comandas reutilizáveis e decide o vínculo antes de criar o agendamento.
async function findOpenCustomerOrders(customerId) {
  const {data,error}=await supabase.from('service_orders')
    .select('id,order_number,status')
    .eq('org_id',state.organization.id)
    .eq('customer_id',customerId)
    .in('status',['open','in_progress','partially_paid','awaiting_payment'])
    .order('created_at',{ascending:false}).limit(20);
  if(error) throw error;
  return data||[];
}
async function selectExistingOrder(orders) {
  if(!orders.length)return {orderId:null,forceNew:false};
  if(orders.length===1) {
    const reuse=window.confirm('Este cliente já possui a comanda #'+orders[0].order_number+' em aberto.\\n\\nOK: manter a mesma comanda.\\nCancelar: criar uma nova quando o atendimento começar.');
    return reuse?{orderId:orders[0].id,forceNew:false}:{orderId:null,forceNew:true};
  }
  const details=orders.map(order=>'#'+order.order_number+' · '+order.status).join('\\n');
  const answer=window.prompt('O cliente possui comandas em aberto. Digite o número da comanda que deseja manter. Deixe vazio para criar uma nova.\\n\\n'+details,'');
  if(answer===null)return null;
  if(!answer.trim())return {orderId:null,forceNew:true};
  const chosen=orders.find(order=>String(order.order_number)===answer.trim());
  if(!chosen){toast('Número de comanda não encontrado.');return null;}
  return {orderId:chosen.id,forceNew:false};
}
// Valida e persiste criação/edição de agendamento no Supabase.
export async function saveAppointment(form) {
  const values=new FormData(form);
  const customerId=String(values.get('customer_id')||'');
  const serviceId=String(values.get('service_id')||'');
  const professionalId=String(values.get('professional_id')||'');
  const date=String(values.get('date')||'');
  const time=String(values.get('time')||'');
  const duration=Number(values.get('duration'));
  const price=parseBRL(values.get('price'));
  const notes=String(values.get('notes')||'').trim();
  if(!customerId||!serviceId||!professionalId)throw new Error('Escolha o cliente, serviço e profissional nas sugestões.');
  if(!date||!time||!Number.isFinite(duration)||duration<5||!Number.isFinite(price)||price<0)throw new Error('Confira data, horário, duração e valor.');
  const start=makeTimestamp(date,time);
  const end=new Date(start.getTime()+duration*60000);
  const [customerResult,serviceResult,professionalResult]=await Promise.all([
    supabase.from('customers').select('id,name,phone').eq('org_id',state.organization.id).eq('id',customerId).maybeSingle(),
    supabase.from('services').select('id,name,price,duration_minutes').eq('org_id',state.organization.id).eq('id',serviceId).maybeSingle(),
    supabase.from('professionals').select('id,name').eq('org_id',state.organization.id).eq('id',professionalId).maybeSingle()
  ]);
  if(customerResult.error)throw customerResult.error;
  if(serviceResult.error)throw serviceResult.error;
  if(professionalResult.error)throw professionalResult.error;
  if(!customerResult.data||!serviceResult.data||!professionalResult.data)throw new Error('Um dos registros selecionados não existe ou está inativo.');

  const existing=appointmentActionRow();
  const payload={
    org_id:state.organization.id,
    customer_id:customerId,
    professional_id:professionalId,
    service_id:serviceId,
    customer_name:customerResult.data.name,
    customer_phone:String(values.get('phone')||customerResult.data.phone||'').trim()||null,
    service_name:serviceResult.data.name,
    professional_name:professionalResult.data.name,
    starts_at:start.toISOString(),
    ends_at:end.toISOString(),
    price,
    notes:notes||null,
    booking_source:state.membership?.role==='professional'?'professional':'salon'
  };

  if(existing?.id) {
    if(existing.dbStatus==='in_progress'||existing.dbStatus==='completed')throw new Error('Um atendimento iniciado ou concluído não pode ser reagendado por este formulário.');
    if(existing.service_order_id && (
      existing.customer_id!==customerId ||
      existing.service_id!==serviceId ||
      existing.professional_id!==professionalId
    )) throw new Error('Este horário já está vinculado a uma comanda. Para manter o histórico correto, altere somente data, horário e observações.');
    payload.status=existing.dbStatus||'scheduled';
    payload.service_order_id=existing.customer_id===customerId?existing.service_order_id:null;
    payload.comanda_strategy=payload.service_order_id?'reuse_open':'new_on_arrival';
    const {error}=await supabase.from('appointments').update(payload)
      .eq('org_id',state.organization.id).eq('id',existing.id);
    if(error)throw error;
    state.drawer=null;
    await loadAgendaPage();
    toast('Agendamento atualizado no banco.');
    return;
  }

  payload.status='scheduled';
  payload.comanda_strategy='new_on_arrival';
  payload.service_order_id=null;
  const activeOrders=await findOpenCustomerOrders(customerId);
  if(activeOrders.length) {
    const choice=await selectExistingOrder(activeOrders);
    if(choice===null)return;
    if(choice.orderId) {
      payload.service_order_id=choice.orderId;
      payload.comanda_strategy='reuse_open';
    } else if(choice.forceNew) {
      payload.comanda_strategy='force_new_on_arrival';
    }
  }
  const {error}=await supabase.from('appointments').insert(payload);
  if(error)throw error;
  state.drawer=null;
  await loadAgendaPage();
  toast('Agendamento criado. Nenhuma comanda foi aberta.');
}
// Atualiza status e timestamps de chegada, cancelamento ou conclusão.
export async function updateAppointmentStatus(appointment,status) {
  const changes={status};
  if(status==='arrived')changes.arrived_at=new Date().toISOString();
  if(status==='cancelled')changes.cancelled_at=new Date().toISOString();
  if(status==='completed')changes.completed_at=new Date().toISOString();
  const {error}=await supabase.from('appointments').update(changes)
    .eq('org_id',state.organization.id).eq('id',appointment.id);
  if(error)throw error;
  state.drawer=null;
  await loadAgendaPage();
}
// Solicita ao backend a abertura transacional da comanda.
export async function openAppointmentOrder(appointment) {
  if(appointment.dbStatus==='cancelled'||appointment.dbStatus==='completed'||appointment.dbStatus==='no_show') {
    throw new Error('Este agendamento não pode abrir uma comanda.');
  }
  let existingId=appointment.service_order_id||null;
  let forceNew=appointment.comanda_strategy==='force_new_on_arrival';
  if(!existingId&&!forceNew) {
    const orders=await findOpenCustomerOrders(appointment.customer_id);
    const choice=await selectExistingOrder(orders);
    if(choice===null)return;
    existingId=choice.orderId;
    forceNew=choice.forceNew;
  }
  let result=null;
  if(appointment.appointment_group_id){
    // A RPC abre todos os serviços do grupo dentro de uma única transação no banco.
    const {data,error}=await supabase.rpc('start_appointment_group_service_order',{
      p_appointment_id:appointment.id,
      p_existing_order_id:existingId,
      p_force_new:forceNew
    });
    if(error)throw error;
    result=data;
  }else{
    const {data,error}=await supabase.rpc('start_appointment_service_order',{
      p_appointment_id:appointment.id,
      p_existing_order_id:existingId,
      p_force_new:forceNew
    });
    if(error)throw error;
    result=data;
  }
  state.drawer=null;
  await loadAgendaPage();
  const count=Number(result?.service_count||1);
  toast('Comanda #'+result.order_number+' aberta com '+count+' serviço(s).');
}
// Roteia ações do drawer para os fluxos de Agenda correspondentes.
export async function handleAppointmentAction(action) {
  const appointment=appointmentActionRow();
  if(!appointment)return;
  if(action==='reschedule') {
    state.drawer.editing=true;
    renderDrawer();
    return;
  }
  if(action==='confirm') {
    await updateAppointmentStatus(appointment,'confirmed');
    toast('Agendamento confirmado.');
    return;
  }
  if(action==='arrived') {
    await updateAppointmentStatus(appointment,'arrived');
    toast('Chegada do cliente registrada. Agora você pode abrir a comanda.');
    return;
  }
  if(action==='open-order') {
    await openAppointmentOrder(appointment);
    return;
  }
  if(action==='cancel') {
    if(!window.confirm('Cancelar este horário? A comanda vinculada também será cancelada quando não houver outro agendamento ativo nela.'))return;
    await updateAppointmentStatus(appointment,'cancelled');
    toast('Horário cancelado e vínculos sincronizados.');
    return;
  }
  if(action==='delete') {
    if(!window.confirm('Excluir este agendamento? Ele ficará disponível em Recuperar por 30 dias.'))return;
    const {error}=await supabase.from('appointments').delete()
      .eq('org_id',state.organization.id).eq('id',appointment.id);
    if(error)throw error;
    state.drawer=null;
    await loadAgendaPage();
    toast('Agendamento excluído e enviado para Recuperar.');
  }
}
// Valida conflitos e persiste bloqueios de disponibilidade.
export async function saveBlockTime(form) {
  const values=new FormData(form);
  const professionalId=String(values.get('professional_id')||'');
  const date=String(values.get('date')||'');
  const startTime=String(values.get('start')||'');
  const endTime=String(values.get('end')||'');
  const reason=String(values.get('reason')||'').trim();
  if(!professionalId||!date||!startTime||!endTime||!reason)throw new Error('Preencha todos os campos do bloqueio.');
  const start=makeTimestamp(date,startTime),end=makeTimestamp(date,endTime);
  if(end<=start)throw new Error('O horário final deve ser posterior ao inicial.');
  const {data:appointments,error:appointmentError}=await supabase.from('appointments')
    .select('id,customer_name').eq('org_id',state.organization.id).eq('professional_id',professionalId)
    .not('status','in','(cancelled,no_show)').lt('starts_at',end.toISOString()).gt('ends_at',start.toISOString()).limit(1);
  if(appointmentError)throw appointmentError;
  if(appointments?.length)throw new Error('Já existe um agendamento neste intervalo ('+appointments[0].customer_name+').');
  const {error}=await supabase.from('appointment_blocks').insert({
    org_id:state.organization.id,professional_id:professionalId,
    starts_at:start.toISOString(),ends_at:end.toISOString(),reason,created_by:state.user.id
  });
  if(error)throw error;
  state.drawer=null;
  await loadAgendaPage();
  toast('Bloqueio salvo no banco.');
}

// Delegação global de cliques: menu, navegação, Agenda, drawers e ações.
