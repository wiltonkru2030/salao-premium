/**
 * SALÃO PREMIUM — regras puras do calendário do App Profissional.
 * Responsabilidade: calcular células mensais, indicadores e compromissos selecionados.
 * Integração: consumido pela view da Agenda; não acessa DOM, rede ou estado global.
 */

import {salonCalendarDate} from "./salon-time.js";

/** Converte uma data válida em chave local AAAA-MM-DD. */
function localDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

/**
 * Calcula o modelo de apresentação de um calendário mensal com seis semanas.
 * @param {{month: Date, selectedDate: Date, appointments?: Array, today?: Date}} input Dados da agenda.
 * @returns {{cells: Array, selectedAppointments: Array}} Modelo pronto para a view.
 * @throws {TypeError} Quando os parâmetros principais forem inválidos.
 */
export function buildMonthlyCalendar({ month, selectedDate, appointments = [], today = new Date(), timezone = null } = {}) {
  if (!(month instanceof Date) || Number.isNaN(month.getTime())) throw new TypeError("O mês informado é inválido.");
  if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) throw new TypeError("A data selecionada é inválida.");
  if (!Array.isArray(appointments)) throw new TypeError("A lista de agendamentos é inválida.");
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) throw new TypeError("A data atual é inválida.");

  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const dayInCalendar = instant => timezone ? salonCalendarDate(instant,timezone) : new Date(instant);
  const appointmentsByDay = new Map();
  for (const appointment of appointments) {
    if (!appointment?.starts_at || Number.isNaN(new Date(appointment.starts_at).getTime())) continue;
    const key = localDateKey(dayInCalendar(appointment.starts_at));
    if (!appointmentsByDay.has(key)) appointmentsByDay.set(key, []);
    appointmentsByDay.get(key).push(appointment);
  }
  const selectedKey = localDateKey(selectedDate), todayKey = localDateKey(dayInCalendar(today));
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, index - firstWeekday + 1);
    const key = localDateKey(date);
    const dayAppointments = appointmentsByDay.get(key) || [];
    return { date, key, day: date.getDate(), inMonth: date.getMonth() === monthIndex,
      selected: key === selectedKey, today: key === todayKey, hasAppointments: dayAppointments.length > 0, statuses: new Set(dayAppointments.map(appointment => appointment.status)) };
  });
  const selectedAppointments = [...(appointmentsByDay.get(selectedKey) || [])]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return { cells, selectedAppointments };
}
