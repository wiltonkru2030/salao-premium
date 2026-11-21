/**
 * Adaptador do App Cliente para disponibilidade e reservas temporárias.
 * Responsabilidade: injetar o cliente Supabase e preservar os contratos da interface.
 * Segurança: o backend usa auth.uid() e revalida expediente/conflitos antes de gravar.
 */
import { supabase } from "../supabase.client.js";
import { validateHoldInput, validateHoldId } from "../utils/appointmentHoldUtils.js";
import {
  getAvailableSlots as fetchSlots,
  createBookingHold,
  confirmBooking,
  releaseBookingHold
} from "./bookingService.js";

/** Consulta horários no fuso e expediente configurados pelo salão. */
export async function getCustomerAvailableSlots(input) {
  return fetchSlots({ client: supabase, ...input });
}

/** Cria HOLD temporário após validar os identificadores e horário desejado. */
export async function createAppointmentHold(input) {
  const valid = validateHoldInput(input);
  return createBookingHold({ client: supabase, ...valid, couponCode: input?.couponCode || null });
}

/** Confirma o HOLD e recebe o identificador do agendamento criado atomicamente. */
export async function confirmAppointmentHold(holdId) {
  return confirmBooking({ client: supabase, holdId: validateHoldId(holdId) });
}

/** Cancela somente o HOLD ativo pertencente à conta autenticada. */
export async function cancelAppointmentHold(holdId) {
  return releaseBookingHold({ client: supabase, holdId: validateHoldId(holdId) });
}
