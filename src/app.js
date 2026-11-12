import { state } from './state.js';
import { installGlobalMasks, parseBRL } from './utils/input-masks.js';
import { installGlobalErrorHandlers, reportError } from './utils/errors.js';

// Inicializa recursos globais compartilhados antes de conectar os eventos da interface.
installGlobalMasks();
installGlobalErrorHandlers();

// A partir daqui ficam os fluxos de Agenda e os eventos globais do painel.
import { $, toast } from './utils.js';
import { changePage, render } from './layout/render.js';
import { recordDrawer, appointmentDrawer, renderDrawer, openDrawer } from './components/drawer.js';
import { supabase } from './supabase/client.js';
import { loadAgendaPage, refreshAgendaContent, findAppointmentView } from './agenda/pages/agenda-page.js';
import { dateKey, addDays } from './agenda/utils/date.utils.js';
import { startAuth, signOut } from './auth/auth.js';

// Conversores de data/horário usados pelos formulários da Agenda.
function dateFromKey(key) {
  const parts=String(key).split('-').map(Number);
  return new Date(parts[0],parts[1]-1,parts[2]);
}
function makeTimestamp(date,time) {
  const value=new Date(String(date)+'T'+String(time)+':00');
  if(Number.isNaN(value.getTime())) throw new Error('Data ou horário inválido.');
  return value;
}
function durationBetween(start,end) {
  return Math.max(5,Math.round((end.getTime()-start.getTime())/60000));
}
function appointmentActionRow() {
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
async function saveAppointment(form) {
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
async function updateAppointmentStatus(appointment,status) {
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
async function openAppointmentOrder(appointment) {
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
  const {data,error}=await supabase.rpc('start_appointment_service_order',{
    p_appointment_id:appointment.id,
    p_existing_order_id:existingId,
    p_force_new:forceNew
  });
  if(error)throw error;
  state.drawer=null;
  await loadAgendaPage();
  toast('Comanda #'+data.order_number+' aberta. O horário agora está em atendimento.');
}
// Roteia ações do drawer para os fluxos de Agenda correspondentes.
async function handleAppointmentAction(action) {
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
async function saveBlockTime(form) {
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
document.addEventListener('click',async event=>{
  const target=event.target;
  const appointmentAction=target.closest('[data-appointment-action]');
  if(appointmentAction) {
    try{await handleAppointmentAction(appointmentAction.dataset.appointmentAction);}
    catch(error){reportError(error,{context:'Agenda > executar ação do atendimento'});}
    return;
  }

  const removeBlock=target.closest('[data-remove-block]');
  if(removeBlock) {
    if(!window.confirm('Remover este bloqueio de horário?'))return;
    const {error}=await supabase.from('appointment_blocks').delete()
      .eq('org_id',state.organization.id).eq('id',removeBlock.dataset.removeBlock);
    if(error){toast(error.message||'Não foi possível remover o bloqueio.');return;}
    await loadAgendaPage();toast('Bloqueio removido.');
    return;
  }

  const monthDay=target.closest('[data-select-date]');
  if(monthDay){state.date=dateFromKey(monthDay.dataset.selectDate);state.view='Dia';refreshAgendaContent();return;}

  const newSlot=target.closest('[data-new-slot]');
  if(newSlot){
    if(newSlot.dataset.newDate)state.date=dateFromKey(newSlot.dataset.newDate);
    state.drawer=null;
    appointmentDrawer(null,{slot:newSlot.dataset.newSlot||''});
    return;
  }

  const pro=target.closest('[data-pro]');
  if(pro){state.pro=Number(pro.dataset.pro);refreshAgendaContent();return;}

  const ap=target.closest('[data-appointment]');
  if(ap){
    const appointment=findAppointmentView(ap.dataset.appointment);
    if(appointment)appointmentDrawer(appointment);
    return;
  }

  const rec=target.closest('[data-record]');
  if(rec){recordDrawer(rec.dataset.recordType,Number(rec.dataset.record));return;}

  const setting=target.closest('[data-setting]');
  if(setting){state.setting=setting.dataset.setting;render();return;}

  const action=target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='sign-out'){signOut().catch(error=>reportError(error,{context:'Autenticação > encerrar sessão'}));return;}
  if(action==='collapse-menu'){state.sidebarCollapsed=!state.sidebarCollapsed;render();return;}
  if(action==='toggle-menu'){state.mobileMenu=true;render();}
  else if(action==='close-menu'){state.mobileMenu=false;render();}
  else if(action==='close-drawer'){state.drawer=null;renderDrawer();}
  else if(action==='edit-appointment'&&state.drawer?.appointment){state.drawer.editing=true;renderDrawer();}
  else if(action==='prev'||action==='next'){
    if(state.view==='Mês')state.date=new Date(state.date.getFullYear(),state.date.getMonth()+(action==='next'?1:-1),1);
    else state.date=addDays(state.date,(action==='next'?1:-1)*(state.view==='Semana'?7:1));
    await loadAgendaPage();
  } else if(action==='today'){state.date=new Date();await loadAgendaPage();}
  else if(action==='new-appointment'){appointmentDrawer(null);}
  else if(action==='block-time'){
    const selected=state.agendaProfessionals?.[state.pro];
    openDrawer({kind:'block',title:'Bloquear horário',pro:selected?.[3]||null,date:dateKey(state.date)});
  } else if(action==='new-record'){
    openDrawer({kind:'record',title:'Novo cadastro',type:state.page,fields:[{label:'Cadastro',value:'Use os campos da página para inserir os dados.'}]});
  } else if(action==='notifications'){toast('Nenhuma notificação nova.');}
});

// Delegação global de formulários: salvar agendamentos e bloqueios.
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.matches('[data-agenda-form]')) {
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='Salvando…';}
    try{await saveAppointment(form);}
    catch(error){reportError(error,{context:'Agenda > salvar agendamento'});}
    finally{if(submit){submit.disabled=false;submit.textContent=state.drawer?.appointment?'Salvar reagendamento':'Criar agendamento';}}
    return;
  }
  if(form.matches('[data-block-time-form]')) {
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='Salvando…';}
    try{await saveBlockTime(form);}
    catch(error){reportError(error,{context:'Agenda > criar bloqueio'});}
    finally{if(submit){submit.disabled=false;submit.textContent='Bloquear horário';}}
  }
});

document.addEventListener('input',event=>{
  if(event.target.matches('[data-agenda-search]')){state.query=event.target.value;refreshAgendaContent();}
});
document.addEventListener('change',async event=>{
  if(event.target.matches('[data-view]')){state.view=event.target.value;await loadAgendaPage();}
  if(event.target.matches('[data-agenda-filter]')){state.filter=event.target.value;refreshAgendaContent();}
  if(event.target.matches('[data-filter]')){const filter=event.target.value.toLocaleLowerCase('pt-BR');document.querySelectorAll('.record-card').forEach(card=>{card.style.display=(!filter||filter==='todos'||card.textContent.toLocaleLowerCase('pt-BR').includes(filter))?'':'none';});}
});

document.addEventListener('dragstart',event=>{
  const card=event.target.closest('[data-appointment]');
  if(card){state.dragId=card.dataset.appointment;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(state.dragId));}
});
document.addEventListener('dragover',event=>{
  const slot=event.target.closest('[data-slot],[data-month-date]');
  if(slot){event.preventDefault();slot.classList.add('drop-target');}
});
document.addEventListener('dragleave',event=>event.target.closest('[data-slot],[data-month-date]')?.classList.remove('drop-target'));
document.addEventListener('drop',async event=>{
  const slot=event.target.closest('[data-slot],[data-month-date]');
  if(!slot||!state.dragId)return;
  event.preventDefault();
  const id=state.dragId;state.dragId=null;slot.classList.remove('drop-target');
  const appointment=findAppointmentView(id);if(!appointment)return;
  const newTime=slot.dataset.slot||appointment.time;
  const newDate=slot.dataset.date||slot.dataset.monthDate||appointment.date;
  const proIndex=Number(slot.dataset.pro??state.pro);
  const professional=state.agendaProfessionals?.[proIndex];
  if(!professional)return;
  const start=makeTimestamp(newDate,newTime);
  const end=new Date(start.getTime()+Number(appointment.duration||30)*60000);
  const {error}=await supabase.from('appointments').update({
    professional_id:professional[3],
    professional_name:professional[1],
    starts_at:start.toISOString(),ends_at:end.toISOString()
  }).eq('org_id',state.organization.id).eq('id',id);
  if(error){toast(error.message||'Não foi possível mover o agendamento.');return;}
  state.date=dateFromKey(newDate);state.pro=proIndex;await loadAgendaPage();toast('Agendamento atualizado no banco.');
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(state.drawer){state.drawer=null;renderDrawer();}
    if(state.mobileMenu){state.mobileMenu=false;render();}
  }
});

startAuth(context=>{
  state.user=context.user;
  state.profile=context.profile;
  state.organization=context.organization;
  state.membership=context.membership;
  render();
});
