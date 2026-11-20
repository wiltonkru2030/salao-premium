/**
 * Serviço de inclusão de serviços realizados em comandas.
 *
 * Responsabilidade: validar os dados mínimos e persistir um item de serviço.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: chamado pelo controlador de interface; usa cliente Supabase injetado.
 * Observação: não substitui RLS, regras transacionais ou restrições do banco.
 */

/**
 * Converte valor monetário para duas casas decimais, sem aceitar valores inválidos.
 * @param {unknown} value Preço informado pelo catálogo.
 * @returns {number} Valor arredondado para centavos.
 * @throws {TypeError} Se o valor não for numérico, finito ou não negativo.
 */
function normalizePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    throw new TypeError("O preço do serviço é inválido.");
  }
  // O arredondamento ocorre antes do envio para evitar frações menores que um centavo.
  return Math.round((price + Number.EPSILON) * 100) / 100;
}

/**
 * Registra um serviço executado na comanda do profissional autenticado.
 *
 * Passos:
 * 1. Valida a conexão e os identificadores obrigatórios.
 * 2. Normaliza o preço para duas casas decimais.
 * 3. Monta o registro com organização, comanda, serviço e profissional.
 * 4. Insere o item e verifica a resposta do Supabase.
 * 5. Em falha, retorna erro seguro sem expor SQL ou detalhes internos.
 *
 * @param {object} options Dados e dependências da operação.
 * @param {object} options.client Cliente Supabase.
 * @param {string} options.organizationId Organização ativa.
 * @param {string} options.orderId Comanda selecionada.
 * @param {object} options.service Serviço escolhido no catálogo.
 * @param {string} options.professionalId Profissional autenticado e vinculado.
 * @param {string} options.userId Identidade autenticada que registra a operação.
 * @param {Date} [options.performedAt=new Date()] Data/hora da realização.
 * @returns {Promise<object>} Item criado, conforme retornado pelo banco.
 * @throws {TypeError|Error} Em dados inválidos ou falha de persistência.
 */
export async function addProfessionalServiceToOrder({
  client,
  organizationId,
  orderId,
  service,
  professionalId,
  userId,
  performedAt = new Date()
}) {
  if (!client || typeof client.from !== "function") {
    throw new TypeError("A conexão com os dados não está disponível.");
  }
  for (const [value, message] of [
    [organizationId, "Não foi possível identificar o salão desta conta."],
    [orderId, "Selecione uma comanda válida."],
    [professionalId, "Não foi possível identificar o profissional."],
    [userId, "Sua sessão não está válida. Entre novamente."]
  ]) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(message);
  }
  if (!service || typeof service.id !== "string" || !service.id.trim()
      || typeof service.name !== "string" || !service.name.trim()) {
    throw new TypeError("Selecione um serviço válido.");
  }
  if (!(performedAt instanceof Date) || Number.isNaN(performedAt.getTime())) {
    throw new TypeError("A data do atendimento é inválida.");
  }

  const price = normalizePrice(service.price);

  try {
    const { data, error } = await client
      .from("service_order_items")
      .insert({
        org_id: organizationId,
        order_id: orderId,
        item_type: "service",
        service_id: service.id,
        professional_id: professionalId,
        description: service.name.trim(),
        quantity: 1,
        unit_price: price,
        total: price,
        performed_at: performedAt.toISOString(),
        created_by: userId
      });

    if (error) {
      const failure = new Error("Não foi possível registrar o serviço na comanda. Verifique os dados e tente novamente.");
      failure.code = "PROFESSIONAL_ORDER_ITEM_CREATE_FAILED";
      throw failure;
    }
    return true;
  } catch (error) {
    if (error?.code === "PROFESSIONAL_ORDER_ITEM_CREATE_FAILED") throw error;
    const failure = new Error("Não foi possível registrar o serviço na comanda. Verifique sua conexão e tente novamente.");
    failure.code = "PROFESSIONAL_ORDER_ITEM_CREATE_FAILED";
    throw failure;
  }
}
