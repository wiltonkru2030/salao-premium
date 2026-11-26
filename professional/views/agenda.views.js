/**
 * SALÃO PREMIUM — view da agenda do App Profissional.
 * Responsabilidade: transformar o modelo de calendário em markup, sem regras de datas ou acesso à rede.
 * Integração: recebe estado e renderizadores auxiliares do compositor professional/app.js.
 */
import { escapeHtml } from "../utils/formatters.js";
import { buildMonthlyCalendar } from "../utils/agenda-rules.js";

// Uma faixa por status presente, na mesma ordem dos rótulos da legenda.
const marks = [["confirmed","Confirmado"],["completed","Finalizado"],["cancelled","Cancelado"],["scheduled","Agendado"]];

/** Gera o risco visual de um estado; o texto equivalente fica no dia e na legenda. */
function renderStatusMark(status) {
  return '<span class="calendar-status-mark calendar-status-mark--'+status+'" aria-hidden="true"></span>';
}

/**
 * Renderiza calendário mensal e compromissos da data selecionada.
 * @param {object} context Estado, formatadores e renderizadores auxiliares.
 * @returns {string} Markup da Agenda.
 */
export function renderAgendaView(context) {
  const { state, monthLabel, dateLabel, appointmentCard, appointmentDetails } = context;
  const { cells, selectedAppointments } = buildMonthlyCalendar({
    month: state.month, selectedDate: state.selectedDate, appointments: state.appointments, timezone:state.organization?.timezone || (state.organization ? "America/Sao_Paulo" : null)
  });
  const calendarCells = cells.map(cell => {
    const classes = [cell.inMonth ? "" : "outside", cell.selected ? "selected" : "", cell.today ? "today" : ""].filter(Boolean).join(" ");
    const statuses = marks.filter(([status])=>cell.statuses.has(status));
    const label = dateLabel(cell.date) + (statuses.length ? " · "+statuses.map(([,name])=>name).join(", ") : "");
    return '<button class="day ' + classes + '" data-date="' + cell.key + '" aria-label="'+escapeHtml(label)+'">' + '<span class="calendar-day-number">' + cell.day + '</span>' +
      (statuses.length ? '<span class="calendar-status-marks">'+statuses.map(([status])=>renderStatusMark(status)).join("")+'</span>' : '') + '</button>';
  }).join("");
  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"].map(day => '<div class="weekday">' + day + '</div>').join("");
  const scopeLabel = state.scope === "calendar_all" || state.scope === "all" ? "Agenda completa autorizada" : "Somente sua agenda";
  return '<div class="section-title"><h2>Agenda mensal</h2><span class="muted">' + scopeLabel + '</span></div>' +
    '<div class="calendar-head"><button data-action="prev-month">‹</button><strong>' + escapeHtml(monthLabel(state.month)) + '</strong><button data-action="next-month">›</button></div>' +
    '<div class="calendar">' + weekdays + calendarCells + '</div>' +
    '<ul class="calendar-status-legend" aria-label="Legenda dos agendamentos">' +
      marks.map(([status,name])=>'<li>'+renderStatusMark(status)+name+'</li>').join("")+'</ul>' +
    '<div class="section-title section-title--tight-spaced"><h2>' + escapeHtml(dateLabel(state.selectedDate)) + '</h2><span class="muted">' + selectedAppointments.length + ' agendamento(s)</span></div>' +
    (selectedAppointments.length ? selectedAppointments.map(appointmentCard).join("") : '<div class="empty">Nenhum agendamento neste dia.</div>') + appointmentDetails();
}
