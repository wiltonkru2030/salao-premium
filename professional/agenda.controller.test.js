/**
 * Testes do controlador de eventos da Agenda do App Profissional.
 *
 * Responsabilidade: validar seleção de datas, navegação mensal, abertura/fechamento
 * de detalhes e delegação de eventos sem depender de navegador ou bibliotecas externas.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: executado pelo script test:professional-agenda-controller do package.json.
 */

import assert from "node:assert/strict";
import { handleAgendaClick } from "./agenda.controller.js";

/**
 * Cria um evento mínimo com o contrato usado pelo controlador.
 *
 * @param {object} controls Elementos simulados indexados pelo seletor CSS.
 * @returns {object} Evento com target.closest compatível com o controlador.
 */
function makeEvent(controls = {}) {
  return {
    target: {
      closest(selector) {
        return controls[selector] || null;
      }
    }
  };
}

/**
 * Cria estado isolado para cada teste.
 *
 * @returns {object} Estado inicial da Agenda.
 */
function makeState() {
  return {
    month: new Date(2026, 10, 1),
    selectedDate: new Date(2026, 10, 20),
    selectedAppointment: null,
    appointments: [{ id: "appointment-1" }]
  };
}

/**
 * Executa os testes e interrompe o processo quando uma regra não for respeitada.
 *
 * @returns {Promise<void>} Resolve quando todos os cenários passam.
 */
async function run() {
  let renders = 0;
  let loads = 0;
  const state = makeState();
  const dependencies = {
    state,
    loadAppointments: async () => { loads += 1; },
    render: () => { renders += 1; }
  };

  const dateControl = { dataset: { date: "2026-12-03" } };
  assert.equal(await handleAgendaClick({
    ...dependencies,
    event: makeEvent({ "[data-date]": dateControl })
  }), true);
  assert.equal(state.month.getMonth(), 11, "A seleção fora do mês deve atualizar o mês exibido.");
  assert.equal(state.selectedDate.getDate(), 3);
  assert.equal(loads, 1, "A troca de mês deve recarregar os agendamentos.");
  assert.equal(renders, 1);

  const appointmentControl = { dataset: { appointment: "appointment-1" } };
  assert.equal(await handleAgendaClick({
    ...dependencies,
    event: makeEvent({ "[data-appointment]": appointmentControl })
  }), true);
  assert.equal(state.selectedAppointment.id, "appointment-1");

  const closeControl = { dataset: { action: "close-appointment" } };
  assert.equal(await handleAgendaClick({
    ...dependencies,
    event: makeEvent({ "[data-action]": closeControl })
  }), true);
  assert.equal(state.selectedAppointment, null);

  const nextMonthControl = { dataset: { action: "next-month" } };
  await handleAgendaClick({
    ...dependencies,
    event: makeEvent({ "[data-action]": nextMonthControl })
  });
  assert.equal(state.month.getMonth(), 0, "A navegação deve avançar para janeiro.");
  assert.equal(loads, 2);

  assert.equal(await handleAgendaClick({
    ...dependencies,
    event: makeEvent()
  }), false, "Eventos de outras áreas devem permanecer com o controlador principal.");

  await assert.rejects(
    () => handleAgendaClick({ ...dependencies, event: makeEvent({
      "[data-date]": { dataset: { date: "data-invalida" } }
    }) }),
    /data selecionada não é válida/
  );

  await assert.rejects(
    () => handleAgendaClick({ event: makeEvent(), state, loadAppointments: null, render: () => {} }),
    /interação da Agenda/
  );

  console.log("Testes do controlador da Agenda: todos passaram.");
}

run().catch(error => {
  console.error("Falha nos testes do controlador da Agenda:", error);
  process.exitCode = 1;
});

const modalState=makeState();await handleAgendaClick({state:modalState,event:makeEvent({"[data-appointment]":{dataset:{appointment:"appointment-1",reschedule:"true"}}}),loadAppointments:async()=>{},render:()=>{}});assert.equal(modalState.appointmentModalMode,"reschedule");
