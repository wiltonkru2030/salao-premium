/**
 * Serviços de leitura de comandas do App Profissional.
 *
 * Responsabilidade: consultar comandas e seus itens sem acoplar consultas Supabase
 * ao controlador de interface.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: app.js injeta o cliente Supabase e os identificadores do contexto ativo.
 */

/**
 * Valida as dependências e os identificadores usados nas consultas.
 * @param {object} client Cliente Supabase configurado.
 * @param {string} organizationId Identificador da organização ativa.
 * @throws {TypeError} Quando uma dependência ou identificador é inválido.
 */
function validateContext(client, organizationId) {
  if (!client || typeof client.from !== "function") {
    throw new TypeError("A conexão com os dados não está disponível.");
  }
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    throw new TypeError("Não foi possível identificar o salão desta conta.");
  }
}

/**
 * Executa uma consulta e padroniza falhas sem expor detalhes internos do banco.
 * @param {Promise<object>} request Consulta Supabase encadeada.
 * @param {string} message Mensagem segura em português.
 * @returns {Promise<Array<object>>} Lista de registros ou lista vazia.
 * @throws {Error} Quando o Supabase ou a rede não concluem a consulta.
 */
async function readRows(request, message) {
  try {
    const { data, error } = await request;
    if (error) {
      const failure = new Error(message);
      failure.code = "PROFESSIONAL_ORDERS_FETCH_FAILED";
      throw failure;
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error?.code === "PROFESSIONAL_ORDERS_FETCH_FAILED") throw error;
    const failure = new Error(message);
    failure.code = "PROFESSIONAL_ORDERS_FETCH_FAILED";
    throw failure;
  }
}

/**
 * Busca as comandas mais recentes da organização do profissional autenticado.
 *
 * A política RLS do banco continua sendo a barreira definitiva de autorização;
 * o filtro por organização reduz o escopo da consulta, mas não substitui a RLS.
 *
 * @param {object} options Dependências da consulta.
 * @param {object} options.client Cliente Supabase.
 * @param {string} options.organizationId Organização ativa.
 * @returns {Promise<Array<object>>} Comandas ordenadas da mais recente para a mais antiga.
 * @throws {TypeError|Error} Em parâmetros inválidos ou falha de leitura.
 */
export async function fetchProfessionalOrders({ client, organizationId, branchId = null }) {
  validateContext(client, organizationId);
  let query=client.from("service_orders").select("id,order_number,status,total,assigned_professional_id,customer_id,branch_id").eq("org_id", organizationId);
  if(branchId)query=query.eq("branch_id",branchId);
  return readRows(
    query.order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
    "Não foi possível carregar as comandas. Verifique sua conexão e tente novamente."
  );
}

/**
 * Busca os itens de uma comanda específica dentro da organização ativa.
 *
 * O filtro duplo por organização e comanda evita consultas acidentais fora
 * do contexto selecionado; a RLS deve validar também o vínculo do profissional.
 *
 * @param {object} options Dependências e identificadores da consulta.
 * @param {object} options.client Cliente Supabase.
 * @param {string} options.organizationId Organização ativa.
 * @param {string} options.orderId Identificador da comanda selecionada.
 * @returns {Promise<Array<object>>} Itens ordenados pela criação.
 * @throws {TypeError|Error} Em parâmetros inválidos ou falha de leitura.
 */
export async function fetchProfessionalOrderItems({ client, organizationId, orderId }) {
  validateContext(client, organizationId);
  if (typeof orderId !== "string" || !orderId.trim()) {
    throw new TypeError("Selecione uma comanda válida.");
  }
  return readRows(
    client.from("service_order_items")
      .select("id,item_type,description,quantity,unit_price,discount,total,professional_id,performed_at,source_appointment_id")
      .eq("org_id", organizationId)
      .eq("order_id", orderId)
      .order("created_at")
      .order("id"),
    "Não foi possível carregar os itens da comanda. Tente novamente."
  );
}
