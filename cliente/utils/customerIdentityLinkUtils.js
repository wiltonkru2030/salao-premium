/**
 * Utilitários puros para apresentação segura de solicitações de vínculo legado.
 *
 * Responsabilidade:
 * - Validar identificadores recebidos da API antes de enviá-los à RPC.
 * - Converter a resposta mínima do backend para o modelo da interface.
 * - Não transportar customer_id, telefone completo ou dados operacionais.
 */

/** Valida UUIDs sem aceitar strings arbitrárias vindas da interface. */
export function validateIdentityLinkRequestId(value) {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TypeError("Solicitação de vínculo inválida.");
  }
  return id;
}

/**
 * Normaliza a resposta mínima da RPC de solicitações pendentes.
 * @param {object} row - Linha retornada pelo backend.
 * @returns {{requestId:string,orgId:string,salonName:string,customerName:string,phoneSuffix:string|null,expiresAt:string}}
 */
export function normalizePendingIdentityLinkRequest(row) {
  if (!row || typeof row !== "object") throw new TypeError("Solicitação de vínculo inválida.");
  const requestId = validateIdentityLinkRequestId(row.request_id);
  const orgId = validateIdentityLinkRequestId(row.org_id);
  const salonName = String(row.salon_name ?? "").trim();
  const customerName = String(row.customer_name ?? "").trim();
  const phoneSuffix = row.phone_suffix == null ? null : String(row.phone_suffix);
  const expiresAt = String(row.expires_at ?? "");
  if (!salonName || !customerName || !Number.isFinite(Date.parse(expiresAt))) {
    throw new TypeError("Os dados da solicitação estão incompletos.");
  }
  if (phoneSuffix !== null && !/^\d{2}$/.test(phoneSuffix)) {
    throw new TypeError("O telefone de confirmação possui formato inválido.");
  }
  return { requestId, orgId, salonName, customerName, phoneSuffix, expiresAt };
}
