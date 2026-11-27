/**
 * Controlador de eventos da Agenda do App Profissional.
 *
 * Responsabilidade: interpretar interações da Agenda e atualizar o estado da tela.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: recebe o estado e as funções de carregamento/renderização do app.js;
 * não acessa Supabase, não cria HTML e não manipula estilos.
 */

/**
 * Verifica se um evento pertence a um seletor e devolve o elemento correspondente.
 *
 * @param {Event} event Evento delegado pelo elemento raiz da aplicação.
 * @param {string} selector Seletor CSS do controle.
 * @returns {Element|null} Elemento encontrado ou null quando não houver correspondência.
 */
function findControl(event, selector) {
  if (!event?.target || typeof event.target.closest !== "function") return null;
  return event.target.closest(selector);
}

/**
 * Trata exclusivamente interações de navegação e seleção da Agenda.
 *
 * Passos:
 * 1. Identifica o controle acionado.
 * 2. Atualiza a data, o mês ou o agendamento selecionado.
 * 3. Recarrega os dados somente quando a navegação muda o mês.
 * 4. Solicita a renderização quando o estado estiver atualizado.
 *
 * @param {object} options Dependências injetadas pelo controlador principal.
 * @param {Event} options.event Evento de clique delegado.
 * @param {object} options.state Estado compartilhado do App Profissional.
 * @param {Function} options.loadAppointments Carrega os agendamentos do mês atual.
 * @param {Function} options.render Renderiza a tela a partir do estado atualizado.
 * @returns {Promise<boolean>} true se o evento foi tratado; false se pertence a outra tela/ação.
 * @throws {TypeError} Quando as dependências obrigatórias estiverem ausentes.
 * @throws {Error} Propaga falhas do carregamento para o controlador principal tratar.
 */
export async function handleAgendaClick({ event, state, loadAppointments, render }) {
  if (!event || !state || typeof loadAppointments !== "function" || typeof render !== "function") {
    throw new TypeError("Não foi possível processar a interação da Agenda.");
  }

  const dateControl = findControl(event, "[data-date]");
  if (dateControl) {
    const dateValue = String(dateControl.dataset.date || "");
    // O horário ao meio-dia evita deslocamentos de dia em fusos com mudança de horário.
    const nextDate = new Date(dateValue + "T12:00:00");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(nextDate.getTime())) {
      throw new TypeError("A data selecionada não é válida.");
    }

    const changedMonth = nextDate.getMonth() !== state.month.getMonth()
      || nextDate.getFullYear() !== state.month.getFullYear();
    state.selectedDate = nextDate;
    state.selectedAppointment=null;state.appointmentModalMode=null;

    if (changedMonth) {
      state.month = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
      await loadAppointments();
    }
    render();
    return true;
  }

  const appointmentControl = findControl(event, "[data-appointment]");
  if (appointmentControl) {
    const appointmentId = String(appointmentControl.dataset.appointment || "");
    state.selectedAppointment = state.appointments.find(item => item.id === appointmentId) || null;
    state.appointmentModalMode=appointmentControl.dataset.reschedule==="true"?"reschedule":"details";
    render();
    return true;
  }

  const action = findControl(event, "[data-action]")?.dataset.action;
  if (action === "prev-month" || action === "next-month") {
    const offset = action === "next-month" ? 1 : -1;
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + offset, 1);
    state.selectedDate = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
    state.selectedAppointment=null;state.appointmentModalMode=null;
    await loadAppointments();
    render();
    return true;
  }

  if (action === "close-appointment") {
    state.selectedAppointment = null;state.appointmentModalMode=null;
    render();
    return true;
  }

  return false;
}
