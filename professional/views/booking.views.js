/** Formulário para marcar um novo horário com cliente já atendido pelo profissional. */
import {escapeHtml, formatDateTime} from "../utils/formatters.js";

/** Monta escolhas a partir dos agendamentos visíveis e dos serviços vinculados. */
export function renderProfessionalBooking({appointments, professionalId, services, timezone}) {
  const references = new Map();
  for (const appointment of appointments) {
    if (appointment.professional_id !== professionalId || !appointment.customer_id || !appointment.branch_id) continue;
    references.set(appointment.customer_id + ":" + appointment.branch_id, appointment);
  }
  if (!references.size || !services.length) {
    return '<details class="detail"><summary>Novo agendamento</summary><p>Selecione um mês com clientes da sua agenda e confira se há serviços ativos vinculados ao seu perfil.</p></details>';
  }

  const clients = [...references.values()].map(appointment =>
    '<option value="' + escapeHtml(appointment.id) + '">' + escapeHtml(appointment.customer_name) +
    ' · atendimento de ' + escapeHtml(formatDateTime(appointment.starts_at)) + '</option>').join("");
  const options = services.map(service => '<option value="' + escapeHtml(service.id) + '">' +
    escapeHtml(service.name) + ' · ' + escapeHtml(service.duration_minutes) + ' min</option>').join("");

  return '<details class="detail"><summary>Novo agendamento</summary><form id="professional-new-appointment">' +
    '<label class="field">Cliente e unidade do atendimento de referência<select name="reference" required>' +
    '<option value="">Selecione um cliente</option>' + clients + '</select></label>' +
    '<label class="field">Serviço<select name="service" required><option value="">Selecione um serviço</option>' +
    options + '</select></label>' +
    '<label class="field">Horário · ' + escapeHtml(timezone || "Fuso do salão") +
    '<input name="start" type="datetime-local" required></label>' +
    '<button type="submit" class="primary">Agendar</button></form></details>';
}
