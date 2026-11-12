import {state} from './state.js';
import {appts} from './data/index.js';
import {$,toast} from './utils.js';
import {cardList} from './pages/records.js';
import {changePage,render} from './layout/render.js';
import {recordDrawer,appointmentDrawer,renderDrawer,openDrawer} from './components/drawer.js';
import {agenda} from './agenda/pages/agenda-page.js';
import {createAppointment,updateAppointment,changeAppointmentStatus} from './agenda/services/agenda.service.js';
import {findConflict} from './agenda/utils/conflict.utils.js';
import {timeToMinutes} from './agenda/utils/duration.utils.js';
import {addDays} from './agenda/utils/date.utils.js';

function dateFromKey(key){const p=String(key).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function blockedConflict(candidate,ignoreId=null){
 const start=timeToMinutes(candidate.time),end=start+Number(candidate.duration||0);
 return (state.blockedTimes||[]).find(b=>b.id!==ignoreId&&b.date===candidate.date&&b.pro===Number(candidate.pro)&&start<timeToMinutes(b.end)&&end>timeToMinutes(b.start));
}

document.addEventListener('click',e=>{
 const target=e.target;
 const removeBlock=target.closest('[data-remove-block]');
 if(removeBlock){state.blockedTimes=(state.blockedTimes||[]).filter(b=>String(b.id)!==removeBlock.dataset.removeBlock);render();toast('Bloqueio removido nesta sessão.');return}
 const monthDay=target.closest('[data-select-date]');
 if(monthDay){state.date=dateFromKey(monthDay.dataset.selectDate);state.view='Dia';render();return}
 const newSlot=target.closest('[data-new-slot]');
 if(newSlot){if(newSlot.dataset.newDate)state.date=dateFromKey(newSlot.dataset.newDate);state.drawer=null;appointmentDrawer(null);return}
 const pro=target.closest('[data-pro]');
 if(pro){state.pro=Number(pro.dataset.pro);render();return}
 const ap=target.closest('[data-appointment]');
 if(ap){const a=appts.find(x=>x.id===Number(ap.dataset.appointment));if(a)appointmentDrawer(a);return}
 const rec=target.closest('[data-record]');
 if(rec){recordDrawer(rec.dataset.recordType,Number(rec.dataset.record));return}
 const setting=target.closest('[data-setting]');
 if(setting){state.setting=setting.dataset.setting;render();return}
 const statusButton=target.closest('[data-appointment-status]');
 if(statusButton&&state.drawer?.appointment){
  const result=changeAppointmentStatus(state.drawer.appointment.id,statusButton.dataset.appointmentStatus);
  if(result.ok){state.drawer=null;render();toast('Status atualizado nesta sessão.')}else toast(result.errors[0]);return;
 }
 const action=target.closest('[data-action]')?.dataset.action;
 if(!action)return;
 if(action==='collapse-menu'){state.sidebarCollapsed=!state.sidebarCollapsed;render();return}\n if(action==='toggle-menu'){state.mobileMenu=true;render()}
 else if(action==='close-menu'){state.mobileMenu=false;render()}
 else if(action==='close-drawer'){state.drawer=null;renderDrawer()}
 else if(action==='edit-appointment'&&state.drawer?.appointment){state.drawer.editing=true;state.drawerLoading=false;renderDrawer()}
 else if(action==='prev'||action==='next'){
  if(state.view==='Mês')state.date=new Date(state.date.getFullYear(),state.date.getMonth()+(action==='next'?1:-1),1);
  else state.date=addDays(state.date,(action==='next'?1:-1)*(state.view==='Semana'?7:1));
  render();
 }else if(action==='today'){state.date=new Date();render()}
 else if(action==='new-appointment'){appointmentDrawer(null)}
 else if(action==='new-record'){openDrawer({kind:'record',title:'Novo cadastro',type:state.page,fields:[{label:'Nome',value:'Preencha os dados'},{label:'Informações',value:'Cadastro demonstrativo'}]})}
 else if(action==='block-time'){openDrawer({kind:'block',title:'Bloquear horário',pro:state.pro})}
 else if(action==='notifications'){toast('Nenhuma notificação nova na demonstração.')}
});

document.addEventListener('submit',e=>{
 const form=e.target;
 if(form.matches('[data-agenda-form]')){
  e.preventDefault();
  const fd=new FormData(form),price=String(fd.get('price')||'').trim();
  const candidate={name:String(fd.get('name')||'').trim(),phone:String(fd.get('phone')||'').trim(),service:String(fd.get('service')||'').trim(),pro:Number(fd.get('pro')),date:String(fd.get('date')||''),time:String(fd.get('time')||''),duration:Number(fd.get('duration')),price:price?(price.startsWith('R$')?price:'R$ '+price):'',status:String(fd.get('status')||'Aguardando'),notes:String(fd.get('notes')||'').trim()};
  if(!candidate.name||!candidate.service||!candidate.date||!candidate.time){toast('Preencha cliente, serviço, data e horário.');return}
  const blocked=blockedConflict(candidate);
  if(blocked){toast('Horário bloqueado: '+blocked.reason+'.');return}
  const existing=state.drawer?.appointment;
  const result=existing?updateAppointment(existing.id,candidate):createAppointment(candidate);
  if(!result.ok){toast(result.errors[0]||'Não foi possível validar o horário.');return}
  state.date=dateFromKey(candidate.date);state.pro=candidate.pro;state.drawer=null;render();toast(existing?'Agendamento atualizado nesta sessão.':'Agendamento criado nesta sessão.');return;
 }
 if(form.matches('[data-block-time-form]')){
  e.preventDefault();
  const fd=new FormData(form),block={id:Date.now(),pro:Number(fd.get('pro')),date:String(fd.get('date')),start:String(fd.get('start')),end:String(fd.get('end')),reason:String(fd.get('reason')||'').trim()};
  const start=timeToMinutes(block.start),end=timeToMinutes(block.end);
  if(!block.date||!block.reason||end<=start){toast('Informe data, motivo e um intervalo válido.');return}
  if(start<timeToMinutes('08:00')||end>timeToMinutes('20:00')){toast('O bloqueio deve ficar entre 08:00 e 20:00.');return}
  const occupied=appts.find(a=>!['Cancelado','Falta'].includes(a.status)&&a.pro===block.pro&&a.date===block.date&&start<timeToMinutes(a.time)+Number(a.duration)&&end>timeToMinutes(a.time));
  if(occupied){toast('Já existe um atendimento nesse intervalo ('+occupied.name+').');return}
  const overlap=(state.blockedTimes||[]).find(b=>b.pro===block.pro&&b.date===block.date&&start<timeToMinutes(b.end)&&end>timeToMinutes(b.start));
  if(overlap){toast('Este período já está bloqueado.');return}
  state.blockedTimes=[...(state.blockedTimes||[]),block];state.date=dateFromKey(block.date);state.pro=block.pro;state.drawer=null;render();toast('Horário bloqueado nesta sessão.');return;
 }
});

document.addEventListener('input',e=>{
 if(e.target.matches('[data-agenda-search]')){state.query=e.target.value;const pos=e.target.selectionStart;$('.page-content').innerHTML=agenda();const input=$('[data-agenda-search]');if(input){input.focus();input.setSelectionRange(pos,pos)}}
 if(e.target.id==='record-search'){state.query=e.target.value;const pos=e.target.selectionStart;const page=state.page;$('.page-content').innerHTML=cardList(page);const input=$('#record-search');if(input){input.focus();input.setSelectionRange(pos,pos)}}
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-view]')){state.view=e.target.value;render()}
 if(e.target.matches('[data-agenda-filter]')){state.filter=e.target.value;render()}
 if(e.target.matches('[data-filter]')){const f=e.target.value.toLocaleLowerCase('pt-BR');document.querySelectorAll('.record-card').forEach(card=>{card.style.display=(!f||card.textContent.toLocaleLowerCase('pt-BR').includes(f))?'':'none'})}
});

document.addEventListener('dragstart',e=>{
 const ap=e.target.closest('[data-appointment]');
 if(ap){state.dragId=Number(ap.dataset.appointment);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(state.dragId))}
});
document.addEventListener('dragover',e=>{const slot=e.target.closest('[data-slot],[data-month-date]');if(slot){e.preventDefault();slot.classList.add('drop-target')}});
document.addEventListener('dragleave',e=>e.target.closest('[data-slot],[data-month-date]')?.classList.remove('drop-target'));
document.addEventListener('drop',e=>{
 const slot=e.target.closest('[data-slot],[data-month-date]');if(!slot||!state.dragId)return;
 e.preventDefault();const id=state.dragId;state.dragId=null;slot.classList.remove('drop-target');
 const ap=appts.find(x=>x.id===id);if(!ap)return;
 const newTime=slot.dataset.slot||ap.time,newDate=slot.dataset.date||slot.dataset.monthDate||ap.date,targetPro=Number(slot.dataset.pro??state.pro);
 const candidate={...ap,time:newTime,date:newDate,pro:targetPro};
 const conflict=findConflict(appts,candidate,id);if(conflict){toast('Conflito com '+conflict.name+'. Escolha outro horário.');return}
 const blocked=blockedConflict(candidate);if(blocked){toast('Este horário está bloqueado: '+blocked.reason+'.');return}
 const result=updateAppointment(id,{time:newTime,date:newDate,pro:targetPro});
 if(!result.ok){toast(result.errors[0]);return}
 state.date=dateFromKey(newDate);state.pro=targetPro;state.view='Dia';render();toast('Agendamento movido nesta sessão. Não foi salvo no banco.');
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(state.drawer){state.drawer=null;renderDrawer()}if(state.mobileMenu){state.mobileMenu=false;render()}}
});
render();
