/**
 * Serviço de disponibilidade e reservas da Área da Cliente.
 * Responsabilidade: validar entradas e chamar RPCs transacionais do Supabase.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 * Segurança: a titularidade depende de auth.uid(); IDs recebidos não concedem acesso.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida cliente Supabase e identificadores UUID.
 * @param {object} client Cliente autenticado.
 * @param {string} value Identificador.
 * @param {string} label Nome do campo para mensagem amigável.
 * @returns {string} UUID normalizado.
 * @throws {TypeError} Se a conexão ou o identificador forem inválidos.
 */
function requireUuid(client, value, label) {
  if (!client || typeof client.rpc !== "function") {
    throw new TypeError("A conexão com o serviço de reservas não está disponível.");
  }
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new TypeError(label + " inválido.");
  }
  return value.trim();
}

/**
 * Converte falhas do backend em mensagens seguras para a cliente.
 * @param {object} error Erro retornado pelo Supabase.
 * @returns {Error} Erro sem detalhes internos de SQL.
 */
function mapBookingError(error) {
  const code = error?.code;
  const messages = {
    "42501": "Entre na sua conta para continuar com a reserva.",
    "23P01": "Este horário acabou de ficar indisponível. Escolha outro.",
    "22023": "Os dados ou o horário não estão mais disponíveis. Confira e tente novamente.",
    "PGRST202": "A consulta de horários ainda está sendo ativada. Tente novamente mais tarde.",
    "42883": "A consulta de horários ainda está sendo ativada. Tente novamente mais tarde.",
    "42P01": "A consulta de horários ainda está sendo ativada. Tente novamente mais tarde."
  };
  const mapped = new Error(messages[code] || "Não foi possível processar a reserva agora. Tente novamente.");
  mapped.code = ["PGRST202", "42883", "42P01"].includes(code)
    ? "BOOKING_BACKEND_NOT_READY"
    : "BOOKING_OPERATION_FAILED";
  return mapped;
}

/**
 * Valida uma seleção simples de serviços e horário.
 * @param {object} input Dados da seleção.
 * @returns {object} Seleção normalizada.
 * @throws {TypeError} Quando faltarem dados ou a data não for futura.
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

/**
 * Consulta horários candidatos no expediente real do salão e do profissional.
 * @param {object} options Conexão e parâmetros da consulta.
 * @returns {Promise<Array<object>>} Horários disponíveis; lista vazia se não houver vagas.
 * @throws {TypeError|Error} Para parâmetros inválidos ou falhas do backend.
 */
export async function getAvailableSlots({
  client, orgId, branchId, serviceId, date, professionalId = null, intervalMinutes = 15
} = {}) {
  requireUuid(client, orgId, "Salão");
  requireUuid(client, branchId, "Unidade");
  requireUuid(client, serviceId, "Serviço");
  if (professionalId !== null) requireUuid(client, professionalId, "Profissional");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date + "T12:00:00Z"))) {
    throw new TypeError("Escolha uma data válida.");
  }
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 60) {
    throw new TypeError("O intervalo entre horários deve estar entre 5 e 60 minutos.");
  }
  const { data, error } = await client.rpc("get_customer_available_slots", {
    p_org_id: orgId,
    p_branch_id: branchId,
    p_service_id: serviceId,
    p_date: date,
    p_professional_id: professionalId,
    p_interval_minutes: intervalMinutes
  });
  if (error) throw mapBookingError(error);
  if (!Array.isArray(data)) throw new Error("O serviço não retornou uma lista válida de horários.");
  return data;
}

/**
 * Cria HOLD temporário para um serviço/profissional escolhido.
 * @param {object} options Dados do HOLD e cliente Supabase.
 * @returns {Promise<{holdId:string,expiresAt:string}>} Reserva temporária criada no banco.
 * @throws {TypeError|Error} Se a seleção for inválida ou o banco rejeitar o horário.
 */
export async function createBookingHold({
  client, orgId, branchId, professionalId, serviceId, startsAt, couponCode = null
} = {}) {
  requireUuid(client, orgId, "Salão");
  requireUuid(client, branchId, "Unidade");
  requireUuid(client, professionalId, "Profissional");
  requireUuid(client, serviceId, "Serviço");
  const date = new Date(startsAt);
  if (typeof startsAt !== "string" || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
    throw new TypeError("Escolha um horário futuro válido.");
  }
  const normalizedCoupon = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : null;
  if (normalizedCoupon && !/^[A-Z0-9_-]{3,32}$/.test(normalizedCoupon)) {
    throw new TypeError("O código do cupom é inválido.");
  }
  const { data, error } = await client.rpc("create_customer_appointment_hold_with_coupon", {
    p_org_id: orgId,
    p_branch_id: branchId,
    p_professional_id: professionalId,
    p_service_id: serviceId,
    p_starts_at: date.toISOString(),
    p_coupon_code: normalizedCoupon
  });
  if (error) throw mapBookingError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !UUID_PATTERN.test(String(row.hold_id || "")) || !Number.isFinite(new Date(row.expires_at).getTime())) {
    throw new Error("O servidor não retornou uma reserva temporária válida.");
  }
  return {
    holdId: row.hold_id,
    expiresAt: new Date(row.expires_at).toISOString(),
    couponId: row.coupon_id || null,
    discountAmount: Number(row.coupon_discount_amount || 0),
    finalAmount: Number(row.coupon_final_amount)
  };
}

/**
 * Confirma HOLD pertencente à conta autenticada; o banco cria agenda e vínculo atomicamente.
 * @param {object} options Cliente Supabase e UUID do HOLD.
 * @returns {Promise<string>} UUID do agendamento confirmado.
 * @throws {TypeError|Error} Se o identificador ou confirmação forem inválidos.
 */
export async function confirmBooking({ client, holdId } = {}) {
  requireUuid(client, holdId, "Reserva temporária");
  const { data, error } = await client.rpc("confirm_customer_appointment_hold_with_coupon", { p_hold_id: holdId });
  if (error) throw mapBookingError(error);
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("O servidor não retornou a confirmação do agendamento.");
  }
  return data;
}

/**
 * Cancela apenas o HOLD ativo da conta autenticada.
 * @param {object} options Cliente Supabase e UUID do HOLD.
 * @returns {Promise<boolean>} true se o HOLD foi cancelado; false se já não estava ativo.
 * @throws {TypeError|Error} Se o identificador ou a operação forem inválidos.
 */
export async function releaseBookingHold({ client, holdId } = {}) {
  requireUuid(client, holdId, "Reserva temporária");
  const { data, error } = await client.rpc("cancel_customer_appointment_hold_with_coupon", { p_hold_id: holdId });
  if (error) throw mapBookingError(error);
  return data === true;
}
