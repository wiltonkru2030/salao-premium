/**
 * Calendário semanal da Agenda.
 * Exibe a régua de horários na lateral e distribui os atendimentos
 * em intervalos de 30 minutos, inclusive inícios como 09:15.
 */
import { startOfWeek, addDays, dateKey } from "../utils/date.utils.js";
import { timeToMinutes } from "../utils/duration.utils.js";
import { renderAppointmentCard } from "./appointment-card.js";
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

function findAppointment(appointments, professionalIndex, key, minute, includeReleased) {
  return appointments.find(appointment => {
    if (appointment.pro !== professionalIndex || appointment.date !== key) return false;
    if (!includeReleased && RELEASED_STATUSES.includes(appointment.status)) return false;
    const start = timeToMinutes(appointment.time);
    return start >= minute && start < minute + SLOT_MINUTES;
  });
}

function isOccupied(appointments, professionalIndex, key, minute) {
  return appointments.some(appointment => {
    if (appointment.pro !== professionalIndex || appointment.date !== key) return false;
    if (RELEASED_STATUSES.includes(appointment.status)) return false;
    const start = timeToMinutes(appointment.time);
    return start <= minute && start + Number(appointment.duration || 30) > minute;
  });
}

function findBlock(blockedTimes, professionalIndex, key, minute) {
  return blockedTimes.find(block =>
    block.pro === professionalIndex &&
    block.date === key &&
    timeToMinutes(block.start) <= minute &&
    timeToMinutes(block.end) > minute
  );
}

function renderWeekSlot(time, key, professionalIndex, appointments, blockedTimes, includeReleased) {
  const minute = timeToMinutes(time);
  const appointment = findAppointment(
    appointments, professionalIndex, key, minute, includeReleased
  );

  if (appointment) return renderAppointmentCard(appointment, true);
  if (isOccupied(appointments, professionalIndex, key, minute)) {
    return '<span class="occupied-slot" aria-hidden="true"></span>';
  }

  const block = findBlock(blockedTimes, professionalIndex, key, minute);
  if (block) {
    return '<span class="week-blocked" title="' + esc(block.reason) +
      '">Bloqueado <button type="button" data-remove-block="' + esc(block.id) +
      '" aria-label="Remover bloqueio">×</button></span>';
  }

  return '<button type="button" class="week-empty" data-new-slot="' + time +
    '" data-new-date="' + key + '" data-pro="' + professionalIndex +
    '" aria-label="Agendar às ' + time + '">＋</button>';
}

/** Renderiza sete dias com horários laterais e ações por intervalo. */
export function renderWeekCalendar({
  date, pro, appointments, blockedTimes = [], includeReleased = false
}) {
  const first = startOfWeek(date);
  const times = createTimeSlots();
  const timeRail = '<div class="week-time-rail">' +
    '<div class="week-day-head"><b>HORÁRIO</b></div>' +
    times.map(time => '<div class="week-time-cell">' + time + '</div>').join("") +
    '</div>';

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(first, index);
    const key = dateKey(day);
    const header = '<div class="week-day-head"><b>' +
      esc(day.toLocaleDateString("pt-BR", { weekday: "short" })) +
      '</b><small>' + day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
      '</small></div>';

    const slots = times.map(time => {
      const slot = renderWeekSlot(
        time, key, pro, appointments, blockedTimes, includeReleased
      );
      return '<div class="week-slot" data-slot="' + time +
        '" data-date="' + key + '" data-pro="' + pro + '">' + slot + '</div>';
    }).join("");

    return '<div class="week-day">' + header + slots + '</div>';
  }).join("");

  return '<section class="week-calendar surface"><div class="week-grid">' +
    timeRail + days + '</div></section>';
}
