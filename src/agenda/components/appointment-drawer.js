/** Componente: drawer de agendamento. Responsabilidade: apresentar detalhes e ações, incluindo o formulário de edição. */
import { esc, status, initials, field } from '../../utils.js';
import { renderAppointmentForm } from './appointment-form.js';

export function renderAppointmentDrawer(d) {
  const a=d.appointment;
  if(d.editing||!a){
    return '<div class="drawer-kicker">AGENDA · '+(a?'REAGENDAR':'NOVO AGENDAMENTO')+'</div>'+
      '<h2>'+(a?'Reagendar atendimento':'Novo agendamento')+'</h2>'+
      '<p class="drawer-description">Selecione cliente, serviço e profissional nas sugestões. Os vínculos são gravados pelos identificadores do banco.</p>'+
      renderAppointmentForm({appointment:a,date:d.date,time:d.slot,pro:d.pro});
  }
  const stateLabel=a.status||'Agendado';
  const actionButton=(label,action,kind='drawer-action')=>'<button type="button" class="'+kind+'" data-appointment-action="'+action+'">'+label+' <span>›</span></button>';
  const source=({customer:'Cliente',salon:'Salão',professional:'Profissional'})[a.booking_source]||'Salão';
  const command=a.service_order_id?field('Comanda vinculada','Em atendimento'):field('Comanda','Ainda não aberta');
  return '<div class="drawer-kicker">AGENDA · PROPRIEDADES</div>'+
    '<h2>Detalhes do agendamento</h2>'+
    '<div class="drawer-client"><span class="avatar">'+initials(a.name||'?')+'</span><div><b>'+esc(a.name)+'</b><small>'+esc(a.phone||'Telefone não informado')+'</small></div>'+status(stateLabel)+'</div>'+
    '<div class="drawer-section"><h3>Atendimento</h3>'+
      field('Serviço',a.service)+field('Profissional',a.professionalName||'—')+
      field('Data',a.date?new Date(a.date+'T12:00:00').toLocaleDateString('pt-BR'):'—')+
      field('Horário',a.time)+field('Duração',(a.duration||0)+' minutos')+
      field('Valor',Number(a.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))+
      field('Origem',source)+field('Quem criou',a.created_by_name||source)+command+
      field('Observações',a.notes||'—')+
    '</div>'+
    '<div class="drawer-section"><h3>Ações do agendamento</h3><div class="action-grid">'+
      actionButton('Confirmar','confirm')+
      actionButton('Cliente chegou','arrived')+
      actionButton(a.service_order_id?'Abrir comanda vinculada':'Abrir comanda','open-order')+
      actionButton('Reagendar','reschedule')+
      actionButton('Cancelar horário','cancel')+
      actionButton('Excluir agendamento','delete')+
    '</div></div>'+
    '<p class="demo-note">Comandas são abertas somente no atendimento. Cancelar o horário também cancela a comanda vinculada quando não houver outro agendamento ativo nela.</p>';
}
