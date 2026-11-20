/**
 * Serviço de consulta do extrato de comissões do profissional.
 *
 * Responsabilidade: carregar comissões e pagamentos recebidos no escopo individual.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: app.js injeta o cliente Supabase e os identificadores da sessão.
 * Segurança: filtros locais complementam, mas nunca substituem as políticas RLS.
 */

/**
 * Valida a conexão e o contexto individual da consulta.
 * @param {object} client Cliente Supabase.
 * @param {string} organizationId Organização ativa.
 * @param {string} professionalId Profissional autenticado.
 * @throws {TypeError} Quando o contexto obrigatório não está disponível.
 */
function validateContext(client, organizationId, professionalId) {
  if (!client || typeof client.from !== "function") {
    throw new TypeError("A conexão com os dados não está disponível.");
  }
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    throw new TypeError("Não foi possível identificar o salão desta conta.");
  }
  if (typeof professionalId !== "string" || !professionalId.trim()) {
    throw new TypeError("Não foi possível identificar o profissional desta conta.");
  }
}

/**
 * Converte uma resposta Supabase em lista e padroniza erros.
 * @param {Promise<object>} request Consulta Supabase.
 * @param {string} message Mensagem segura apresentada ao usuário.
 * @returns {Promise<Array<object>>} Registros encontrados.
 * @throws {Error} Quando a consulta falha.
 */
async function readRows(request, message) {
  try {
    const { data, error } = await request;
    if (error) throw new Error("COMMISSION_QUERY_FAILED");
    return Array.isArray(data) ? data : [];
  } catch {
    const failure = new Error(message);
    failure.code = "PROFESSIONAL_COMMISSIONS_FETCH_FAILED";
    throw failure;
  }
}

/**
 * Busca comissões e pagamentos pertencentes ao profissional autenticado.
 * @param {object} options Dependências da consulta.
 * @param {object} options.client Cliente Supabase.
 * @param {string} options.organizationId Organização ativa.
 * @param {string} options.professionalId Profissional autenticado.
 * @returns {Promise<{commissions:Array<object>,payouts:Array<object>}>} Extrato individual.
 * @throws {TypeError|Error} Em contexto inválido ou falha de leitura.
 */
export async function fetchProfessionalCommissions({ client, organizationId, professionalId }) {
  validateContext(client, organizationId, professionalId);
  const commissionRequest = client.from("commissions")
    .select("id,base_amount,rate,amount,status,paid_at,created_at,professional_id,payout_id")
    .eq("org_id", organizationId)
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false })
    .limit(250);
  const payoutRequest = client.from("commission_payouts")
    .select("id,professional_id,amount,payment_method,paid_at,notes")
    .eq("org_id", organizationId)
    .eq("professional_id", professionalId)
    .order("paid_at", { ascending: false })
    .limit(250);

  const [commissions, payouts] = await Promise.all([
    readRows(commissionRequest, "Não foi possível carregar suas comissões. Tente novamente."),
    readRows(payoutRequest, "Não foi possível carregar seus pagamentos. Tente novamente.")
  ]);
  return { commissions, payouts };
}
