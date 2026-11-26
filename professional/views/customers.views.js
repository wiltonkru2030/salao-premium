/** Apresenta clientes dos agendamentos do próprio profissional no mês da Agenda. */
import {escapeHtml} from "../utils/formatters.js";

/** Agrupa os agendamentos autorizados por cliente e mostra o contato disponível. */
export function renderProfessionalCustomers(appointments, professionalId, monthLabel) {
  const customers = new Map();
  for (const appointment of appointments) {
    if (!professionalId || appointment.professional_id !== professionalId || !appointment.customer_id) continue;
    customers.set(appointment.customer_id, appointment);
  }

  const rows = [...customers.values()]
    .sort((left, right) => String(left.customer_name || "").localeCompare(String(right.customer_name || ""), "pt-BR"))
    .map(customer => '<article class="detail"><strong>' + escapeHtml(customer.customer_name || "Cliente") +
      '</strong><p class="meta">' + escapeHtml(customer.customer_phone || "Telefone não informado") +
      '</p></article>').join("");

  return '<section aria-labelledby="professional-customers-heading">' +
    '<div class="section-title"><h2 id="professional-customers-heading">Clientes</h2></div>' +
    '<p class="muted">Clientes da sua agenda de ' + escapeHtml(monthLabel) + '.</p>' +
    (rows || '<p class="empty">Nenhum cliente na sua agenda deste mês.</p>') + '</section>';
}
