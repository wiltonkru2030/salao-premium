/**
 * Valida e normaliza os dados públicos de reserva temporária.
 * Não substitui as verificações transacionais executadas pelo PostgreSQL.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateHoldId(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new TypeError("Identificador da reserva temporária inválido.");
  }
  return value.trim();
}

export function validateHoldInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Informe os dados do horário desejado.");
  }
  const fields = ["orgId", "branchId", "professionalId", "serviceId"];
  const normalized = {};
  for (const field of fields) {
    const value = input[field];
    if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
      throw new TypeError("Os dados do salão, unidade, profissional ou serviço são inválidos.");
    }
    normalized[field] = value.trim();
  }
  const date = new Date(input.startsAt);
  if (typeof input.startsAt !== "string" || !Number.isFinite(date.getTime())) {
    throw new TypeError("Informe uma data e um horário válidos.");
  }
  if (date.getTime() <= Date.now()) {
    throw new TypeError("Escolha um horário futuro.");
  }
  normalized.startsAt = date.toISOString();
  return normalized;
}

export function normalizeCreatedHold(row) {
  if (!row || typeof row !== "object") {
    throw new TypeError("O servidor não retornou os dados da reserva.");
  }
  const holdId = validateHoldId(row.hold_id);
  const expiresAt = new Date(row.expires_at);
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new TypeError("O prazo da reserva retornado pelo servidor é inválido.");
  }
  return { holdId, expiresAt: expiresAt.toISOString() };
}
