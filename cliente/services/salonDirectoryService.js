/**
 * Serviço de descoberta pública de salões e catálogos.
 * Responsabilidade: consultar somente RPCs que expõem dados explicitamente publicados.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 * Segurança: não consulta tabelas privadas diretamente; aceita cliente Supabase injetado.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida o cliente Supabase usado para leitura pública.
 * @param {object} client Cliente Supabase.
 * @throws {TypeError} Quando não houver RPC disponível.
 */
function validateClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new TypeError("A conexão com a busca de salões não está disponível.");
  }
}

/**
 * Traduz falhas de RPC em mensagens sem detalhes internos.
 * @param {object} error Erro Supabase.
 * @returns {Error} Erro de domínio seguro.
 */
function mapDirectoryError(error) {
  const unavailable = ["PGRST202", "42883", "42P01"].includes(error?.code);
  const failure = new Error(unavailable
    ? "A vitrine pública ainda está sendo ativada. Tente novamente mais tarde."
    : "Não foi possível consultar os salões. Verifique sua conexão e tente novamente.");
  failure.code = unavailable ? "CUSTOMER_DIRECTORY_NOT_READY" : "CUSTOMER_DIRECTORY_FETCH_FAILED";
  return failure;
}

/**
 * Pesquisa salões e filiais que optaram por publicação.
 * @param {object} options Filtros e cliente Supabase.
 * @returns {Promise<Array<object>>} Unidades publicadas, com distância quando informada.
 * @throws {TypeError|Error} Para filtros inválidos ou falhas da RPC.
 */
export async function searchPublicSalons({
  client, query = null, city = null, state = null,
  latitude = null, longitude = null, radiusKm = 30, limit = 30
} = {}) {
  validateClient(client);
  const clean = (value, label, max) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string" || value.trim().length > max) {
      throw new TypeError(label + " inválido.");
    }
    return value.trim();
  };
  const searchTerm = clean(query, "Busca", 120);
  const cityName = clean(city, "Cidade", 100);
  const stateCode = clean(state, "Estado", 2);
  if (stateCode && !/^[a-z]{2}$/i.test(stateCode)) throw new TypeError("Informe a sigla do estado com duas letras.");
  if ((latitude === null) !== (longitude === null)) throw new TypeError("Informe latitude e longitude juntas.");
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new TypeError("A localização informada é inválida.");
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 200) {
    throw new TypeError("O raio de busca deve estar entre 0 e 200 km.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError("A quantidade de resultados deve estar entre 1 e 100.");
  }
  const { data, error } = await client.rpc("search_public_salons", {
    p_query: searchTerm,
    p_city: cityName,
    p_state: stateCode?.toUpperCase() || null,
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_km: radiusKm,
    p_limit: limit
  });
  if (error) throw mapDirectoryError(error);
  if (!Array.isArray(data)) throw new Error("A busca retornou um formato inválido.");
  return data;
}

/**
 * Consulta o catálogo de uma vitrine e filial publicadas.
 * @param {object} options Cliente Supabase, slug e filial opcional.
 * @returns {Promise<Array<object>>} Serviços e profissionais públicos da filial.
 * @throws {TypeError|Error} Para identificadores inválidos ou falhas da RPC.
 */
export async function getPublicSalonCatalog({ client, slug, branchId = null } = {}) {
  validateClient(client);
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
    throw new TypeError("O endereço público do salão é inválido.");
  }
  if (branchId !== null && (typeof branchId !== "string" || !UUID_PATTERN.test(branchId))) {
    throw new TypeError("A unidade selecionada é inválida.");
  }
  const { data, error } = await client.rpc("get_public_salon_catalog", {
    p_slug: slug.trim(),
    p_branch_id: branchId
  });
  if (error) throw mapDirectoryError(error);
  if (!Array.isArray(data)) throw new Error("O catálogo retornou um formato inválido.");
  return data;
}
