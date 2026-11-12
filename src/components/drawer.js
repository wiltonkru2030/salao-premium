import {state} from '../state.js';
import {pros,records} from '../data/index.js';
import { $,esc,status,initials,btn,field } from '../utils.js';
import {renderAppointmentForm} from '../agenda/components/appointment-form.js';
import {renderBlockTimeFields} from '../agenda/components/block-time-modal.js';
import {dateKey} from '../agenda/utils/date.utils.js';

function openDrawer(data){
 state.drawer={...data};state.drawerLoading=true;renderDrawer();
 setTimeout(()=>{if(state.drawer&&state.drawer.title===data.title){state.drawerLoading=false;renderDrawer()}},120);
}
function recordDrawer(type,index){
 const r=(records[type]||[])[index];if(!r)return;
 openDrawer({kind:'record',title:r[0],type,fields:r.slice(2).map((v,i)=>({label:(['Informação','Detalhes','Valor / situação'][i]||'Detalhe'),value:v}))});
}
function appointmentDrawer(a){
 openDrawer({kind:'appointment',appointment:a?{...a}:null,title:a?'Propriedades do agendamento':'Novo agendamento',slot:a?.time||'',pro:a?.pro??state.pro,editing:!a});
}
function renderDrawer(){
 const root=$('#drawer-root');if(!root)return;
 if(!state.drawer){root.innerHTML='';return}
 if(state.drawerLoading){root.innerHTML='<div class="drawer-backdrop"></div><aside class="detail-drawer loading-drawer"><div class="drawer-loading"><span class="loading-spinner"></span><small>Carregando informações…</small></div></aside>';return}
 const d=state.drawer;let body='';
 if(d.kind==='appointment'){
  const a=d.appointment;
  if(d.editing||!a){
   body='<div class="drawer-kicker">AGENDA · '+(a?'EDIÇÃO':'NOVO')+'</div><h2>'+(a?'Editar agendamento':'Novo agendamento')+'</h2><p class="drawer-description">Informe os dados do atendimento. Os conflitos de horário são verificados antes da atualização local.</p>'+renderAppointmentForm({appointment:a,date:dateKey(state.date),time:d.slot,pro:d.pro});
  }else{
   body='<div class="drawer-kicker">AGENDA · PROPRIEDADES</div><h2>Detalhes do agendamento</h2><div class="drawer-client"><span class="avatar">'+initials(a.name||'?')+'</span><div><b>'+esc(a.name)+'</b><small>'+esc(a.phone||'Telefone não informado')+'</small></div>'+status(a.status)+'</div>'+
   '<div class="drawer-section"><h3>Atendimento</h3>'+field('Serviço',a.service)+field('Profissional',pros[a.pro]?.[1]||'—')+field('Data',new Date(a.date+'T12:00:00').toLocaleDateString('pt-BR'))+field('Horário',a.time)+field('Duração',(a.duration||0)+' minutos')+field('Valor',a.price||'Não informado')+field('Observações',a.notes||'—')+'</div>'+
   '<div class="drawer-section"><h3>Ações rápidas</h3><div class="action-grid"><button class="drawer-action" data-action="edit-appointment">Editar informações <span>›</span></button>'+
   ['Confirmado','Em atendimento','Finalizado','Cancelado','Falta'].map(s=>'<button class="drawer-action" data-appointment-status="'+s+'">'+({'Confirmado':'Confirmar','Em atendimento':'Iniciar atendimento','Finalizado':'Finalizar atendimento','Cancelado':'Cancelar agendamento','Falta':'Registrar falta'}[s])+' <span>›</span></button>').join('')+
   '</div></div><p class="demo-note">As alterações são temporárias e permanecem apenas nesta sessão.</p>';
  }
 }else if(d.kind==='block'){
  body='<div class="drawer-kicker">AGENDA · DISPONIBILIDADE</div><h2>Bloquear horário</h2><p class="drawer-description">Reserve um período para intervalo, compromisso ou indisponibilidade do profissional.</p>'+renderBlockTimeFields({date:dateKey(state.date),time:d.slot||'09:00',pro:d.pro??state.pro});
 }else{
  body='<div class="drawer-kicker">'+esc(d.type||'CADASTRO')+' · PROPRIEDADES</div><h2>'+esc(d.title)+'</h2><p class="drawer-description">Informações deste registro.</p><div class="drawer-section"><h3>Detalhes</h3>'+((d.fields||[]).map(f=>field(f.label,f.value)).join(''))+'</div><p class="demo-note">A edição dos cadastros será conectada ao banco de dados posteriormente.</p>';
 }
 root.innerHTML='<div class="drawer-backdrop" data-action="close-drawer"></div><aside class="detail-drawer" role="dialog" aria-modal="true" aria-label="'+esc(d.title)+'"><div class="drawer-top"><span class="drawer-brand">SALÃO PREMIUM</span><button class="icon-btn close-drawer" data-action="close-drawer" aria-label="Fechar painel">×</button></div><div class="drawer-content">'+body+'</div><div class="drawer-bottom">'+btn('Fechar','close-drawer')+'</div></aside>';
}
export {openDrawer,recordDrawer,appointmentDrawer,renderDrawer};
