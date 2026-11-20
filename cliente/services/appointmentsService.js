/**
 * Serviço de histórico de agendamentos da Área da Cliente.
 * Responsabilidade: consultar somente registros associados à identidade autenticada.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 * Integração: usa RPC privada por wrapper público; auth.uid() determina a titularidade.
 */
const PAGE_SIZE = 250;

/**
 * Valida a dependência de acesso ao Supabase.
 * @param {object} client Cliente Supabase.
 * @throws {TypeError} Quando a conexão não oferece RPC.
 */
function validateClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new TypeError("A conexão com seus agendamentos não está disponível.");
  }
}

/**
 * Consulta todas as páginas do histórico, sem aceitar ID de cliente no navegador.
 * @param {object} client Cliente Supabase autenticado.
 * @returns {Promise<Array<object>>} Histórico integral permitido pela RPC.
 * @throws {Error} Quando uma página falha; não devolve resultado parcial.
 */
async function readAllAppointments(client) {
  const rows = [];
  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.rpc("get_my_customer_appointments")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        if (["PGRST202", "42883", "42P01"].includes(error.code)) {
          const unavailable = new Error("O histórico de agendamentos ainda está sendo ativado. Tente novamente mais tarde.");
          unavailable.code = "CUSTOMER_APPOINTMENTS_NOT_READY";
          throw unavailable;
        }
        throw new Error("CUSTOMER_APPOINTMENTS_QUERY_FAILED");
      }
      const page = Array.isArray(data) ? data : [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  } catch (error) {
    if (error?.code === "CUSTOMER_APPOINTMENTS_NOT_READY") throw error;
    const failure = new Error("Não foi possível carregar seus agendamentos. Verifique sua conexão e tente novamente.");
    failure.code = "CUSTOMER_APPOINTMENTS_FETCH_FAILED";
    throw failure;
  }
}

/**
 * Busca o histórico da cliente autenticada.
 * @param {object} options Opções da consulta.
 * @param {object} options.client Cliente Supabase autenticado, injetado pelo compositor.
 * @returns {Promise<Array<object>>} Agendamentos da própria identidade.
 * @throws {TypeError|Error} Em dependência inválida ou falha de leitura.
 */
export async function fetchMyCustomerAppointments({ client } = {}) {
  validateClient(client);
  return readAllAppointments(client);
}
