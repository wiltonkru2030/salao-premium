/** Formulário para marcar um novo horário com cliente já atendido pelo profissional. */
import {salonTimezone} from "../utils/salon-time.js";
import {escapeHtml, formatDateTime} from "../utils/formatters.js";

/** Monta escolhas a partir dos agendamentos visíveis e dos serviços vinculados. */
export function renderProfessionalBooking({appointments, professionalId, professionalBranchId, services, timezone}) {
  const references = new Map();
  for (const appointment of appointments) {
    const branch = appointment.branch_id || professionalBranchId;
    if (appointment.professional_id !== professionalId || !appointment.customer_id || !branch) continue;
    references.set(appointment.customer_id + ":" + branch, appointment);
  }
  const clients = [...references.values()].map(appointment =>
    '<option value="' + escapeHtml(appointment.id) + '">' + escapeHtml(appointment.customer_name) +
    ' · atendimento de ' + escapeHtml(formatDateTime(appointment.starts_at,salonTimezone(timezone))) + '</option>').join("");
  const options = services.map(service => '<option value="' + escapeHtml(service.id) + '">' +
    escapeHtml(service.name) + ' · ' + escapeHtml(service.duration_minutes) + ' min</option>').join("");

  const trigger = '<button class="btn primary" type="button" data-action="open-professional-booking">Novo agendamento</button>';
  const unavailable = !references.size ? "Nenhum cliente elegível neste mês." : !services.length ? "Nenhum serviço vinculado." : "";
  const body = unavailable ? '<p class="sp-modal-body">'+unavailable+'</p>' :
    '<form id="professional-new-appointment"><div class="sp-modal-body">' +
    '<label class="field">Cliente<select name="reference" required>' +
    '<option value="">Selecione um cliente</option>' + clients + '</select></label>' +
    '<label class="field">Serviço<select name="service" required><option value="">Selecione um serviço</option>' +
    options + '</select></label>' +
    '<label class="field">Horário · ' + escapeHtml(timezone || "Fuso do salão") +
    '<input name="start" type="datetime-local" required></label>' +
    '<p class="sp-span" data-booking-error role="alert" hidden></p></div>' +
    '<footer class="sp-modal-foot"><button type="button" class="btn secondary" data-action="close-professional-booking">Cancelar</button>' +
    '<button type="submit" class="btn primary">Agendar</button></footer></form>';
  return '<div class="professional-booking-action">'+trigger+'</div>'+
    '<dialog id="professional-booking-dialog" class="sp-modal professional-booking-sheet" aria-labelledby="professional-booking-title">'+
    '<div class="sp-modal-shell"><header class="sp-modal-head"><h2 id="professional-booking-title">Novo agendamento</h2>'+
    '<button type="button" class="sp-modal-close" data-action="close-professional-booking" aria-label="Fechar">×</button></header>'+
    body+'</div></dialog>';
}
