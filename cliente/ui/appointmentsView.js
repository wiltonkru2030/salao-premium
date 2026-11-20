/**
 * Tela de agendamentos da cliente.
 * Responsabilidade: apresentar histórico real, estados de carregamento, vazio e erro.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 */
import { escapeClientHtml } from "./view-utils.js";

const STATUS_LABELS = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Cliente chegou",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu"
};

/** Formata data/hora em pt-BR sem presumir fuso diferente do aparelho. */
function dateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data não disponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Formata preço usando a moeda brasileira. */
function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Valor não disponível";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

/**
 * Renderiza a lista recebida do serviço autenticado.
 * @param {object} options Estado da tela.
 * @param {Array<object>} [options.appointments=[]] Agendamentos da própria cliente.
 * @param {boolean} [options.loading=false] Indica consulta em andamento.
 * @param {string} [options.error=""] Mensagem segura de erro.
 * @returns {string} HTML da tela.
 */
export function renderAppointmentsView({ appointments = [], loading = false, error = "", changeOptions = [], change = null } = {}) {
  const heading = '<div class="page-heading"><span class="eyebrow">SUA ROTINA</span><h1>Agendamentos</h1><p>Seus próximos horários e seu histórico em um só lugar.</p></div>';
  if (loading) {
    return '<section class="page-content">' + heading + '<div class="empty-state"><span class="spinner"></span><p>Carregando seus agendamentos…</p></div></section>';
  }
  if (error) {
    return '<section class="page-content">' + heading +
      '<div class="empty-state"><h3>Não foi possível carregar</h3><p>' + escapeClientHtml(error) + '</p><button class="client-button compact" data-action="reload-appointments">Tentar novamente</button></div></section>';
  }
  if (!appointments.length) {
    return '<section class="page-content">' + heading +
      '<div class="empty-state"><span class="empty-icon">▣</span><h3>Nenhum agendamento encontrado</h3><p>Quando você confirmar um horário em um salão, ele aparecerá aqui.</p></div></section>';
  }
  const options = new Map(changeOptions.map(row=>[row.appointment_id,row]));
  const cards = appointments.map(item => {
    const status = STATUS_LABELS[item.status] || "Status atualizado";
    const service = item.service_name || "Serviço";
    const salon = item.salon_name || "Salão";
    const branch = item.branch_name || "";
    const professional = item.professional_name || "Profissional não informado";
    const permission=options.get(item.appointment_id);
    const id=escapeClientHtml(item.appointment_id);
    const actions=permission&&Date.parse(item.starts_at)>Date.now()? '<div class="appointment-actions">'+(permission.can_cancel?'<button type="button" class="text-button" data-action="open-cancel-appointment" data-appointment-id="'+id+'">Cancelar</button>':'')+(permission.can_reschedule?'<button type="button" class="client-button compact" data-action="open-reschedule-appointment" data-appointment-id="'+id+'">Reagendar</button>':'')+'</div>':'';
    return '<article class="appointment-card">' +
      '<div class="appointment-card-heading"><strong>' + escapeClientHtml(service) + '</strong><span class="tag">' + escapeClientHtml(status) + '</span></div>' +
      '<p class="appointment-salon">' + escapeClientHtml(salon) + (branch ? ' · ' + escapeClientHtml(branch) : '') + '</p>' +
      '<p class="appointment-meta">' + escapeClientHtml(dateTime(item.starts_at)) + '</p>' +
      '<p class="appointment-meta">Com ' + escapeClientHtml(professional) + '</p>' +
      '<strong class="appointment-price">' + escapeClientHtml(money(item.price)) + '</strong>'+actions+(change?.appointmentId===item.appointment_id?renderChangePanel(change,item):'')+'</article>';
  }).join("");
  return '<section class="page-content">' + heading + '<div class="appointment-list">' + cards + '</div></section>';
}

/** Painel de confirmação; nunca altera dados apenas ao abrir. */
function renderChangePanel(change,item){
 const close='<button type="button" class="text-button" data-action="close-appointment-change">Voltar sem alterar</button>';
 const details='<p class="client-note">'+escapeClientHtml(item.service_name||"Serviço")+' · '+escapeClientHtml(dateTime(item.starts_at))+'</p>';
 if(change.action==="cancel")return '<section class="booking-confirm-card" aria-label="Confirmar cancelamento"><h3>Cancelar agendamento?</h3>'+details+'<p>Seu horário será liberado para outra cliente.</p><button type="button" class="client-button" data-action="submit-appointment-change">Confirmar cancelamento</button>'+close+'</section>';
 const slots=change.slots||[];
 const dates='<label>Nova data<input type="date" name="rescheduleDate" value="'+escapeClientHtml(change.date||"")+'"></label><button type="button" class="client-button compact" data-action="load-reschedule-slots">Buscar horários</button>';
 const formatSlot=value=>{try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:change.timezone||undefined}).format(new Date(value));}catch{return dateTime(value);}};
 const choices=change.loading?'<p>Consultando horários…</p>':change.searched?(slots.length?'<div class="available-slot-list">'+slots.map((slot,index)=>'<button type="button" class="slot-option" data-action="select-reschedule-slot" data-slot-index="'+index+'" aria-pressed="'+(slot.starts_at===change.newStart)+'">'+escapeClientHtml(formatSlot(slot.starts_at))+'</button>').join("")+'</div>':'<p>Nenhum horário disponível nessa data.</p>'):'';
 const confirm=change.newStart?'<p>Confirme o novo horário: '+escapeClientHtml(formatSlot(change.newStart))+'</p><button type="button" class="client-button" data-action="submit-appointment-change">Confirmar reagendamento</button>':'';
 return '<section class="booking-confirm-card" aria-label="Reagendar atendimento"><h3>Escolher novo horário</h3>'+details+'<p>O serviço e o profissional permanecem os mesmos.</p>'+dates+choices+confirm+(change.error?'<p class="client-error-text">'+escapeClientHtml(change.error)+'</p>':'')+close+'</section>';
}
