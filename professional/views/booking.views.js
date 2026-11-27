/** Formulário móvel de agendamento. A Agenda fornece o dia selecionado. */

import {escapeHtml as esc} from "../utils/formatters.js";
/** Monta o botão e o diálogo com campos de pesquisa e hora. */
export function renderProfessionalBooking({unitBooking=false,availableSlots=false,selectedDateLabel=""}={}) {
  return `<div class="professional-booking-action">
    <button class="btn primary" type="button" data-action="open-professional-booking">+ Novo agendamento</button>
  </div>
  <dialog id="professional-booking-dialog" class="sp-modal professional-booking-sheet" aria-labelledby="professional-booking-title">
    <div class="sp-modal-shell">
      <header class="sp-modal-head">
        <h2 id="professional-booking-title">Novo agendamento</h2>
        <button type="button" class="sp-modal-close" data-action="close-professional-booking" aria-label="Fechar">×</button>
      </header>
      <form id="professional-new-appointment" data-unit-booking="${unitBooking}" data-available-slots="${availableSlots}">
        <div class="sp-modal-body">
          ${selectedDateLabel?'<p class="muted">Dia selecionado: '+esc(selectedDateLabel)+'</p>':""}
          <div class="sp-span sp-labeled-field"><label for="professional-booking-client">Cliente</label><div class="booking-search-field"><input id="professional-booking-client" type="search" data-booking-client placeholder="Buscar por nome ou telefone" autocomplete="off" required></div></div>
          <div class="sp-span sp-labeled-field"><label for="professional-booking-service">Serviço</label><div class="booking-search-field"><input id="professional-booking-service" type="search" data-booking-service placeholder="Buscar serviço" autocomplete="off" required></div></div>
          <label class="sp-span sp-labeled-field">Hora<input name="start" type="time" step="60" required></label>
          ${availableSlots?'<label class="sp-span sp-labeled-field">Horários livres (opcional)<select data-booking-suggestions disabled><option value="">Selecione um serviço primeiro</option></select></label><p class="muted" data-booking-slot-status role="status">Você também pode informar a hora diretamente. A disponibilidade será conferida ao agendar.</p><button class="btn secondary" type="button" data-booking-retry hidden>Atualizar horários livres</button>':""}
          <p class="sp-span" data-booking-error role="alert" hidden></p>
        </div>
        <footer class="sp-modal-foot">
          <button type="button" class="btn secondary" data-action="close-professional-booking">Cancelar</button>
          <button type="submit" class="btn primary">Agendar</button>
        </footer>
      </form>
      ${unitBooking?`<form id="professional-booking-quick-customer" hidden>
        <div class="sp-modal-body">
          <h3>Cadastro rápido de cliente</h3>
          <label class="sp-labeled-field">Nome<input name="name" required minlength="2" maxlength="120" autocomplete="name"></label>
          <label class="sp-labeled-field">WhatsApp ou telefone<input name="phone" data-mask="phone" inputmode="tel" autocomplete="tel" required></label>
          <p role="alert" data-quick-customer-error hidden></p>
        </div>
        <footer class="sp-modal-foot"><button type="button" class="btn secondary" data-booking-quick-back>Voltar</button><button type="submit" class="btn primary">Salvar e selecionar</button></footer>
      </form>`:""}
    </div>
  </dialog>`;
}

/** Reúne as referências autorizadas, mantendo uma opção por cliente e unidade. */
export function getProfessionalBookingClients({appointments, professional}) {
  const references = new Map();
  for (const appointment of appointments) {
    const branch = appointment.branch_id || professional.branch_id;
    if (appointment.professional_id !== professional.id || !appointment.customer_id || !branch) continue;
    references.set(appointment.customer_id + ":" + branch, {
      id:appointment.id, name:appointment.customer_name, phone:appointment.customer_phone,
      label:appointment.customer_name
    });
  }
  return [...references.values()];
}
