/** Apresenta clientes dos agendamentos do próprio profissional no mês da Agenda. */
import {formatSavedPhone} from "../../src/utils/input-masks.js";
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
    .map(customer => {
      const phone = String(customer.customer_phone || "");
      const digits = phone.replace(/\D/g,"");
      return '<article class="detail sp-content-surface" data-professional-search-text="'+escapeHtml(customer.customer_name||"")+
        '" data-professional-phone="'+digits+'"><strong>'+escapeHtml(customer.customer_name||"Cliente")+
        '</strong><p class="meta">'+escapeHtml(formatSavedPhone(phone)||"Telefone não informado")+'</p>'+
        '<div class="professional-card-actions"><button class="btn secondary" type="button" data-customer-visit="'+
        escapeHtml(customer.id)+'">Ver atendimento</button>'+
        (digits.length>=10&&digits.length<=15?'<a class="btn secondary" href="tel:'+(phone.trim().startsWith("+")?"+":"")+digits+'">Ligar</a>':'')+
        '</div></article>';
    }).join("");

  return '<section data-professional-list aria-labelledby="professional-customers-heading">' +
    '<div class="section-title"><h2 id="professional-customers-heading">Clientes</h2></div>' +
    '<p class="muted">Clientes da sua agenda de ' + escapeHtml(monthLabel) + '.</p>' +
    '<label class="sp-labeled-field">Buscar cliente<input type="search" data-professional-list-search placeholder="Nome ou telefone"></label>'+
    '<p class="empty sp-content-surface sp-content-surface--empty" data-professional-search-empty hidden>Nenhum cliente encontrado.</p>'+
    (rows || '<p class="empty sp-content-surface sp-content-surface--empty">Nenhum cliente na sua agenda deste mês.</p>') + '</section>';
}
