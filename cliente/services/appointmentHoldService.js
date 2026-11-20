/**
 * Serviço de reservas temporárias da Área da Cliente.
 * Responsabilidade: criar, confirmar e cancelar HOLD usando RPCs do Supabase.
 * A autorização final é sempre validada pelo banco usando auth.uid().
 */
import { supabase } from "../../src/supabase/client.js";
import {
  validateHoldInput,
  validateHoldId,
  normalizeCreatedHold
} from "../utils/appointmentHoldUtils.js";

function mapHoldError(error) {
  const code = error?.code;
  if (code === "42501" || code === "PGRST301") {
    return new Error("Sua sessão não está autorizada para esta reserva. Entre novamente.");
  }
  if (code === "23P01") {
    return new Error(error?.message?.includes("bloqueado")
      ? "Este horário está bloqueado. Escolha outro."
      : "Este horário acabou de ser ocupado. Escolha outro.");
  }
  if (code === "22023") return new Error(error?.message || "Os dados da reserva são inválidos.");
  if (code === "PGRST202" || code === "42883" || code === "42P01") {
    return new Error("A reserva online ainda está sendo preparada. Tente novamente mais tarde.");
  }
  return new Error("Não foi possível processar sua reserva agora. Tente novamente.");
}

/** Garante sessão autenticada antes de chamar qualquer RPC de reserva. */
async function requireCustomerSession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Entre na sua conta para reservar um horário.");
  return data.user;
}

/** Cria uma reserva temporária de cinco minutos sem criar membership antecipadamente. */
export async function createAppointmentHold(input) {
  const valid = validateHoldInput(input);
  await requireCustomerSession();
  const { data, error } = await supabase.rpc("create_customer_appointment_hold", {
    p_org_id: valid.orgId,
    p_branch_id: valid.branchId,
    p_professional_id: valid.professionalId,
    p_service_id: valid.serviceId,
    p_starts_at: valid.startsAt
  });
  if (error) throw mapHoldError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeCreatedHold(row);
}

/** Confirma o HOLD; o banco cria cliente, vínculo, agenda e auditoria atomicamente. */
export async function confirmAppointmentHold(holdId) {
  const id = validateHoldId(holdId);
  await requireCustomerSession();
  const { data, error } = await supabase.rpc("confirm_customer_appointment_hold", {
    p_hold_id: id
  });
  if (error) throw mapHoldError(error);
  if (typeof data !== "string" || !data) {
    throw new Error("O servidor não retornou a confirmação do agendamento.");
  }
  return data;
}

/** Libera somente o HOLD ativo que pertence à conta autenticada. */
export async function cancelAppointmentHold(holdId) {
  const id = validateHoldId(holdId);
  await requireCustomerSession();
  const { data, error } = await supabase.rpc("cancel_customer_appointment_hold", {
    p_hold_id: id
  });
  if (error) throw mapHoldError(error);
  return data === true;
}
