/**
 * Serviço de salões favoritos da identidade global.
 * Responsabilidade: adicionar, listar e remover favoritos sem criar vínculo com tenant.
 * Segurança: auth.uid() identifica a cliente; RLS e RPC controlam a leitura.
 */

/** Valida a conexão Supabase e recupera a identidade autenticada atual. */
async function currentUser(client) {
  if (!client?.auth?.getUser || !client?.from || !client?.rpc) {
    throw new TypeError("A conexão da conta não está disponível.");
  }
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user?.id)throw new Error("Entre na sua conta para acessar os favoritos.");
  return data.user;
}

/** Valida UUID recebido da interface. */
function requireOrgId(value) {
  if(typeof value!=="string"||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(value)) {
    throw new TypeError("O salão selecionado é inválido.");
  }
  return value;
}

/** Converte falhas do backend em mensagens seguras. */
function mapFavoriteError(error) {
  if(["PGRST202","42P01","PGRST205"].includes(error?.code)) {
    const failure=new Error("Os favoritos ainda estão sendo ativados. Tente novamente mais tarde.");
    failure.code="FAVORITES_NOT_READY";
    return failure;
  }
  if(error?.code==="42501")return new Error("Este salão não está publicado ou sua conta não pode favoritar este estabelecimento.");
  return new Error("Não foi possível atualizar seus favoritos. Tente novamente.");
}

/**
 * Lista salões favoritos e suas unidades publicadas.
 * @param {object} options Cliente Supabase autenticado.
 * @returns {Promise<Array<object>>} Vitrines favoritas visíveis publicamente.
 */
export async function listFavorites({client}={}) {
  await currentUser(client);
  const {data,error}=await client.rpc("list_my_favorite_salons");
  if(error)throw mapFavoriteError(error);
  if(!Array.isArray(data))throw new Error("A lista de favoritos retornou um formato inválido.");
  return data;
}

/**
 * Adiciona uma organização publicada aos favoritos da cliente.
 * @param {object} options Cliente Supabase e orgId.
 * @returns {Promise<boolean>} true quando o favorito existe.
 */
export async function addFavorite({client,orgId}={}) {
  const user=await currentUser(client);
  const validOrgId=requireOrgId(orgId);
  const {error}=await client.from("customer_favorites").insert({auth_user_id:user.id,org_id:validOrgId});
  if(error&&error.code!=="23505")throw mapFavoriteError(error);
  return true;
}

/**
 * Remove um favorito pertencente exclusivamente à conta autenticada.
 * @param {object} options Cliente Supabase e orgId.
 * @returns {Promise<boolean>} true se uma linha foi removida.
 */
export async function removeFavorite({client,orgId}={}) {
  const user=await currentUser(client);
  const validOrgId=requireOrgId(orgId);
  const {data,error}=await client.from("customer_favorites").delete()
    .eq("auth_user_id",user.id).eq("org_id",validOrgId).select("org_id");
  if(error)throw mapFavoriteError(error);
  return Array.isArray(data)&&data.length>0;
}
