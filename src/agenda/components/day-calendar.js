/**
 * Calendário diário da Agenda.
 * Cada linha representa um intervalo de 30 minutos; atendimentos iniciados
 * entre duas marcações são exibidos no intervalo correspondente.
 */
import { dateKey } from "../utils/date.utils.js";
import { timeToMinutes } from "../utils/duration.utils.js";
import { renderAppointmentCard } from "./appointment-card.js";
import { renderTimeSlot } from "./time-slot.js";
import { esc } from "../../utils.js";

const FIRST_HOUR = 8;
const SLOT_COUNT = 24;
const SLOT_MINUTES = 30;
const RELEASED_STATUSES = ["Cancelado", "Falta"];

function createTimeSlots() {
  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const minutes = FIRST_HOUR * 60 + index * SLOT_MINUTES;
    return String(Math.floor(minutes / 60)).padStart(2, "0") +
      ":" + String(minutes % 60).padStart(2, "0");
  });
}

function isVisibleAppointment(appointment, includeReleased) {
  return includeReleased || !RELEASED_STATUSES.includes(appointment.status);
}

function appointmentAtSlot(appointments, key, professionalIndex, slotMinute, includeReleased) {
  return appointments.find(appointment => {
    if (appointment.date !== key || appointment.pro !== professionalIndex) return false;
    if (!isVisibleAppointment(appointment, includeReleased)) return false;
    const startMinute = timeToMinutes(appointment.time);
    return startMinute >= slotMinute && startMinute < slotMinute + SLOT_MINUTES;
  });
}

function isOccupied(appointments, key, professionalIndex, minute) {
  return appointments.some(appointment => {
    if (appointment.date !== key || appointment.pro !== professionalIndex) return false;
    if (RELEASED_STATUSES.includes(appointment.status)) return false;
    const start = timeToMinutes(appointment.time);
    return start <= minute && start + Number(appointment.duration || 30) > minute;
  });
}

function blockAtSlot(blockedTimes, key, professionalIndex, minute) {
  return blockedTimes.find(block =>
    block.date === key &&
    block.pro === professionalIndex &&
    timeToMinutes(block.start) <= minute &&
    timeToMinutes(block.end) > minute
  );
}

function renderScheduleSlot(time, key, professionalIndex, appointments, blockedTimes, includeReleased) {
  const minute = timeToMinutes(time);
  const appointment = appointmentAtSlot(
    appointments, key, professionalIndex, minute, includeReleased
  );

  if (appointment) {
    return renderTimeSlot(time, key, professionalIndex, renderAppointmentCard(appointment));
  }

  if (isOccupied(appointments, key, professionalIndex, minute)) {
    return '<div class="schedule-slot occupied-slot" aria-hidden="true"></div>';
  }

  const block = blockAtSlot(blockedTimes, key, professionalIndex, minute);
  if (block) {
    return '<div class="schedule-slot blocked-slot" title="' + esc(block.reason) +
      '"><span>Bloqueado · ' + esc(block.reason) +
      '</span><button type="button" class="remove-block" data-remove-block="' +
      esc(block.id) + '" aria-label="Remover bloqueio">×</button></div>';
  }

  return renderTimeSlot(time, key, professionalIndex);
}

function renderAvailability(time, key, professionalIndex, appointments, blockedTimes) {
  const minute = timeToMinutes(time);
  const busy = isOccupied(appointments, key, professionalIndex, minute);
  const blocked = Boolean(blockAtSlot(blockedTimes, key, professionalIndex, minute));
  const status = blocked ? "Bloqueado" : busy ? "Ocupado" : "Disponível";

  return '<div class="availability-cell"><span>' + status + "</span>" +
    (blocked || busy ? "" :
      '<button type="button" data-new-slot="' + time +
      '" data-new-date="' + key +
      '" aria-label="Agendar às ' + time + '">＋</button>') +
    "</div>";
}

/** Renderiza a grade do dia com horários, atendimentos e disponibilidade. */
export function renderDayCalendar({
  date, pro, professional, appointments, blockedTimes = [], includeReleased = false
}) {
  const key = dateKey(date);
  const times = createTimeSlots();

  return '<section class="calendar surface">' +
    '<div class="calendar-header">' +
      '<div class="time-heading">HORÁRIO</div>' +
      '<div>' + esc(professional[1]) + '<small>' + esc(professional[2]) + '</small></div>' +
      '<div class="availability-heading">DISPONIBILIDADE</div>' +
    '</div>' +
    '<div class="calendar-body">' +
      '<div class="time-column">' +
        times.map(time => '<div class="time-cell">' + time + '</div>').join("") +
      '</div>' +
      '<div class="schedule-column">' +
        times.map(time => renderScheduleSlot(
          time, key, pro, appointments, blockedTimes, includeReleased
        )).join("") +
      '</div>' +
      '<div class="availability-column">' +
        times.map(time => renderAvailability(
          time, key, pro, appointments, blockedTimes
        )).join("") +
      '</div>' +
    '</div>' +
  '</section>';
}
