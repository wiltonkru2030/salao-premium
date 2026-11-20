/**
 * Módulo: bookingService.js
 * Responsabilidade: validar a entrada do fluxo de reserva e definir o contrato de HOLD.
 * A criação e confirmação só serão habilitadas após RPCs transacionais e constraint
 * anti-sobreposição no PostgreSQL; nunca simular uma reserva no navegador.
 */
export function validateBookingSelection(input = {}) {
  const { orgId, branchId, serviceIds, professionalId = null, startsAt } = input;
  if (!orgId || !branchId) throw new Error("Selecione o salão e a unidade para continuar.");
  if (!Array.isArray(serviceIds) || serviceIds.length === 0 || serviceIds.some(id => typeof id !== "string" || !id)) {
    throw new Error("Selecione pelo menos um serviço.");
  }
  const start = new Date(startsAt);
  if (!startsAt || Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    throw new Error("Escolha uma data e um horário futuros.");
  }
  return { orgId, branchId, serviceIds: [...new Set(serviceIds)], professionalId, startsAt: start.toISOString() };
}

function bookingBackendUnavailable() {
  const error = new Error("A reserva online será liberada após a ativação da trava transacional de horários.");
  error.code = "BOOKING_BACKEND_NOT_READY";
  return error;
}

export async function getAvailableSlots() { throw bookingBackendUnavailable(); }
export async function createBookingHold() { throw bookingBackendUnavailable(); }
export async function confirmBooking() { throw bookingBackendUnavailable(); }
export async function releaseBookingHold() { throw bookingBackendUnavailable(); }
