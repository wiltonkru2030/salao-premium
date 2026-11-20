/**
 * Serviço de consulta do extrato de comissões do profissional.
 *
 * Responsabilidade: carregar todo o histórico de comissões e repasses no escopo individual.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: app.js injeta o cliente Supabase e os identificadores da sessão.
 * Segurança: filtros por organização/profissional complementam, mas não substituem RLS.
 */

const PAGE_SIZE = 250;

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
 * Busca todas as páginas de uma consulta mantendo filtros e ordenação.
 * @param {Function} buildQuery Cria uma consulta Supabase sem paginação.
 * @param {string} message Mensagem segura para falhas de leitura.
 * @returns {Promise<Array<object>>} Todos os registros visíveis ao usuário.
 * @throws {Error} Quando qualquer página falha; não retorna histórico parcial.
 */
async function readAllRows(buildQuery, message) {
  const rows = [];
  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await buildQuery()
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error("COMMISSION_QUERY_FAILED");
      const page = Array.isArray(data) ? data : [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  } catch {
    const failure = new Error(message);
    failure.code = "PROFESSIONAL_COMMISSIONS_FETCH_FAILED";
    throw failure;
  }
}

/**
 * Busca o histórico integral de comissões e repasses do profissional autenticado.
 * @param {object} options Dependências da consulta.
 * @param {object} options.client Cliente Supabase.
 * @param {string} options.organizationId Organização ativa.
 * @param {string} options.professionalId Profissional autenticado.
 * @returns {Promise<{commissions:Array<object>,payouts:Array<object>}>} Extrato individual completo.
 * @throws {TypeError|Error} Em contexto inválido ou falha em qualquer página.
 */
export async function fetchProfessionalCommissions({ client, organizationId, professionalId }) {
  validateContext(client, organizationId, professionalId);

  const commissionsQuery = () => client.from("commissions")
    .select("id,base_amount,rate,amount,status,paid_at,created_at,professional_id,payout_id")
    .eq("org_id", organizationId)
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  const payoutsQuery = () => client.from("commission_payouts")
    .select("id,professional_id,amount,payment_method,paid_at,notes")
    .eq("org_id", organizationId)
    .eq("professional_id", professionalId)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false });

  const [commissions, payouts] = await Promise.all([
    readAllRows(commissionsQuery, "Não foi possível carregar suas comissões. Tente novamente."),
    readAllRows(payoutsQuery, "Não foi possível carregar seus pagamentos. Tente novamente.")
  ]);
  return { commissions, payouts };
}
