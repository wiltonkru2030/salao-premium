/** Formulário móvel de agendamento. A Agenda fornece o dia selecionado. */
import {escapeHtml, formatDateTime} from "../utils/formatters.js";
import {salonTimezone} from "../utils/salon-time.js";

/** Monta o botão e o diálogo com campos de pesquisa e hora. */
export function renderProfessionalBooking() {
  return `<div class="professional-booking-action">
    <button class="btn primary" type="button" data-action="open-professional-booking">Novo agendamento</button>
  </div>
  <dialog id="professional-booking-dialog" class="sp-modal professional-booking-sheet" aria-labelledby="professional-booking-title">
    <div class="sp-modal-shell">
      <header class="sp-modal-head">
        <h2 id="professional-booking-title">Novo agendamento</h2>
        <button type="button" class="sp-modal-close" data-action="close-professional-booking" aria-label="Fechar">×</button>
      </header>
      <form id="professional-new-appointment">
        <div class="sp-modal-body">
          <div class="sp-span sp-labeled-field"><label for="professional-booking-client">Cliente</label><div><input id="professional-booking-client" type="search" data-booking-client placeholder="Buscar por nome ou telefone" autocomplete="off" required></div></div>
          <div class="sp-span sp-labeled-field"><label for="professional-booking-service">Serviço</label><div><input id="professional-booking-service" type="search" data-booking-service placeholder="Buscar serviço" autocomplete="off" required></div></div>
          <label class="sp-span">Hora<input name="start" type="time" required></label>
          <p class="sp-span" data-booking-error role="alert" hidden></p>
        </div>
        <footer class="sp-modal-foot">
          <button type="button" class="btn secondary" data-action="close-professional-booking">Cancelar</button>
          <button type="submit" class="btn primary">Agendar</button>
        </footer>
      </form>
    </div>
  </dialog>`;
}

/** Reúne as referências autorizadas, mantendo uma opção por cliente e unidade. */
export function getProfessionalBookingClients({appointments, professional, timezone}) {
  const references = new Map();
  for (const appointment of appointments) {
    const branch = appointment.branch_id || professional.branch_id;
    if (appointment.professional_id !== professional.id || !appointment.customer_id || !branch) continue;
    const date = formatDateTime(appointment.starts_at,salonTimezone(timezone));
    references.set(appointment.customer_id + ":" + branch, {
      id:appointment.id, name:appointment.customer_name, phone:appointment.customer_phone,
      label:appointment.customer_name + " · " + date
    });
  }
  return [...references.values()];
}
