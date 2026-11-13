/**
 * Controlador de eventos da Agenda administrativa.
 * Registra eventos de calendário, formulários, bloqueios e arrastar/soltar.
 * Regras e gravações ficam em appointment-actions.js.
 */
import { state } from "../../state.js";
import { $, toast } from "../../utils.js";
import { reportError } from "../../utils/errors.js";
import { changePage, render } from "../../layout/render.js";
import { recordDrawer, appointmentDrawer, renderDrawer, openDrawer } from "../../components/drawer.js";
import { supabase } from "../../supabase/client.js";
import { loadAgendaPage, refreshAgendaContent, findAppointmentView } from "../pages/agenda-page.js";
import { dateKey, addDays } from "../utils/date.utils.js";
import { signOut } from "../../auth/auth.js";
import { dateFromKey, makeTimestamp, appointmentActionRow, saveAppointment, updateAppointmentStatus, openAppointmentOrder, handleAppointmentAction, saveBlockTime } from "./appointment-actions.js";

export function installAgendaController() {
document.addEventListener('click',async event=>{
 try{
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
    if(error){reportError(error,{context:'Agenda > remover bloqueio'});return;}
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
 }catch(error){reportError(error,{context:'Painel > ação de clique'});}
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
 try{
  if(event.target.matches('[data-view]')){state.view=event.target.value;await loadAgendaPage();}
  if(event.target.matches('[data-agenda-filter]')){state.filter=event.target.value;refreshAgendaContent();}
  if(event.target.matches('[data-filter]')){const filter=event.target.value.toLocaleLowerCase('pt-BR');document.querySelectorAll('.record-card').forEach(card=>{card.style.display=(!filter||filter==='todos'||card.textContent.toLocaleLowerCase('pt-BR').includes(filter))?'':'none';});}
 }catch(error){reportError(error,{context:'Agenda > alterar visualização ou filtro'});}
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
 try{
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
  if(error){reportError(error,{context:'Agenda > mover agendamento'});return;}
  state.date=dateFromKey(newDate);state.pro=proIndex;await loadAgendaPage();toast('Agendamento atualizado no banco.');
 }catch(error){reportError(error,{context:'Agenda > soltar agendamento no calendário'});}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(state.drawer){state.drawer=null;renderDrawer();}
    if(state.mobileMenu){state.mobileMenu=false;render();}
  }
});
}
