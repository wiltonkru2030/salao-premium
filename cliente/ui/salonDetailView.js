/**
 * Detalhe público do salão e catálogo da unidade.
 * Responsabilidade: mostrar somente serviços e profissionais retornados pela vitrine publicada.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 */
import { escapeClientHtml } from "./view-utils.js";

/** Formata preço em reais. */
function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
    : "Consulte o salão";
}

/** Formata um horário do backend para a localidade brasileira. */
function timeLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(date)
    : "Horário inválido";
}

/** Retorna a data local do aparelho no formato YYYY-MM-DD. */
function localDateValue() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

/**
 * Agrupa linhas do RPC por serviço e monta formulário de consulta de horários.
 * @param {object} options Dados públicos do salão, catálogo e estado da reserva.
 * @returns {string} HTML do detalhe do salão.
 */
export function renderSalonDetailView({
  salon = null, catalog = [], loading = false, error = "",
  slots = {items:[],loading:false,error:""}, hold = null
} = {}) {
  if (loading) return '<section class="page-content"><div class="empty-state"><span class="spinner"></span><p>Carregando catálogo do salão…</p></div></section>';
  if (error) return '<section class="page-content"><button class="text-button" data-action="back-home">‹ Voltar aos salões</button><div class="empty-state"><h3>Catálogo indisponível</h3><p>' + escapeClientHtml(error) + '</p></div></section>';
  const first = catalog[0] || salon || {};
  const groups = new Map();
  catalog.forEach(row => {
    if (!groups.has(row.service_id)) groups.set(row.service_id, []);
    groups.get(row.service_id).push(row);
  });
  const cards = [...groups.entries()].map(([serviceId, rows]) => {
    const service = rows[0];
    const professionals = [...new Map(rows.filter(row => row.professional_id).map(row =>
      [row.professional_id, {id:row.professional_id,name:row.professional_name,specialty:row.specialty}]
    )).values()];
    const options = professionals.map(pro =>
      '<option value="' + escapeClientHtml(pro.id) + '">' + escapeClientHtml(pro.name) +
      (pro.specialty ? ' · ' + escapeClientHtml(pro.specialty) : '') + '</option>'
    ).join("");
    const matchingSlots = slots.serviceId === serviceId;
    let slotContent = "";
    if (matchingSlots && slots.loading) {
      slotContent = '<p class="client-note">Consultando horários disponíveis…</p>';
    } else if (matchingSlots && slots.error) {
      slotContent = '<p class="client-error-text">' + escapeClientHtml(slots.error) + '</p>';
    } else if (matchingSlots && slots.items?.length) {
      slotContent = '<div class="available-slot-list">' + slots.items.map((slot,index) =>
        '<button type="button" class="slot-option" data-action="create-hold" data-slot-index="' + index + '">' +
        escapeClientHtml(timeLabel(slot.starts_at)) + ' · ' + escapeClientHtml(slot.professional_name) + '</button>'
      ).join("") + '</div>';
    } else if (matchingSlots) {
      slotContent = '<p class="client-note">Não há horários disponíveis nesta data.</p>';
    }
    return '<article class="service-result-card" data-service-card="' + escapeClientHtml(serviceId) + '">' +
      '<div class="service-result-heading"><div><strong>' + escapeClientHtml(service.service_name) + '</strong><small>' +
      escapeClientHtml(service.category || "Serviço") + ' · ' + escapeClientHtml(service.duration_minutes) + ' min</small></div><b>' +
      escapeClientHtml(money(service.price)) + '</b></div>' +
      (service.service_description ? '<p>' + escapeClientHtml(service.service_description) + '</p>' : '') +
      '<label>Profissional<select name="professionalId" ' + (professionals.length ? '' : 'disabled') + '>' +
      (professionals.length ? '<option value="">Qualquer profissional</option>' + options : '<option value="">Nenhum profissional disponível</option>') +
      '</select></label>' +
      '<label>Data<input type="date" name="date" min="' + localDateValue() + '" value="' +
      escapeClientHtml(matchingSlots ? slots.date : '') + '"></label>' +
      '<button type="button" class="client-button" data-action="view-slots" data-service-id="' + escapeClientHtml(serviceId) +
      '" ' + (professionals.length ? '' : 'disabled') + '>Ver horários</button>' +
      slotContent + '</article>';
  }).join("");
  let holdContent = "";
  if (hold) {
    holdContent = '<section class="booking-confirm-card"><h3>Horário reservado temporariamente</h3><p>Confirme antes de ' +
      escapeClientHtml(timeLabel(hold.expiresAt)) + ' para concluir o agendamento.</p>' +
      '<button class="client-button" data-action="confirm-booking">Confirmar agendamento</button>' +
      '<button class="text-button" data-action="cancel-hold">Cancelar reserva temporária</button></section>';
  }
  return '<section class="page-content"><button class="text-button" data-action="back-home">‹ Voltar aos salões</button>' +
    '<div class="page-heading"><span class="eyebrow">VITRINE PUBLICADA</span><h1>' + escapeClientHtml(first.display_name || "Salão") +
    '</h1><p>' + escapeClientHtml(first.description || "Conheça os serviços desta unidade.") + '</p></div>' +
    '<div class="location-card"><div><strong>' + escapeClientHtml(first.branch_name || "Unidade") + '</strong><small>' +
    escapeClientHtml([first.public_address,first.neighborhood,first.city,first.state].filter(Boolean).join(" · ")) + '</small></div></div>' +
    (catalog.length ? '<div class="section-heading"><h2>Serviços e profissionais</h2></div><div class="service-result-list">' + cards + '</div>' :
      '<div class="empty-state">Nenhum serviço está publicado nesta unidade.</div>') +
    holdContent + '</section>';
}
