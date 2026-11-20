/**
 * Serviço da central de notificações da cliente.
 * Responsabilidade: ler e marcar notificações internas da identidade autenticada.
 * Segurança: a tabela aplica RLS por auth_user_id; o cliente não pode inserir notificações.
 */

/** Valida cliente e recupera a identidade atual para operações em lote. */
async function currentUser(client) {
  if(!client?.auth?.getUser||!client?.from)throw new TypeError("A conexão das notificações não está disponível.");
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user?.id)throw new Error("Entre na sua conta para consultar notificações.");
  return data.user;
}

/** Traduz erros de tabela ausente ou falha de rede sem expor detalhes internos. */
function mapNotificationError(error) {
  const unavailable=["PGRST202","42P01","PGRST205"].includes(error?.code);
  const failure=new Error(unavailable
    ?"A central de notificações ainda está sendo ativada."
    :"Não foi possível atualizar suas notificações. Tente novamente.");
  failure.code=unavailable?"NOTIFICATIONS_NOT_READY":"NOTIFICATIONS_OPERATION_FAILED";
  return failure;
}

/**
 * Lista notificações recentes da cliente.
 * @param {object} options Cliente Supabase e limite opcional.
 * @returns {Promise<Array<object>>} Notificações da própria conta.
 */
export async function listNotifications({client,limit=50}={}) {
  await currentUser(client);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new TypeError("Quantidade de notificações inválida.");
  const {data,error}=await client.from("customer_notifications")
    .select("id,org_id,appointment_id,kind,title,body,read_at,created_at")
    .order("created_at",{ascending:false}).limit(limit);
  if(error)throw mapNotificationError(error);
  return Array.isArray(data)?data:[];
}

/**
 * Marca uma notificação própria como lida.
 * @param {object} options Cliente Supabase e UUID da notificação.
 * @returns {Promise<boolean>} true se o registro foi atualizado.
 */
export async function markNotificationRead({client,notificationId}={}) {
  await currentUser(client);
  if(typeof notificationId!=="string"||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(notificationId)) {
    throw new TypeError("Notificação inválida.");
  }
  const {data,error}=await client.from("customer_notifications").update({read_at:new Date().toISOString()})
    .eq("id",notificationId).select("id").maybeSingle();
  if(error)throw mapNotificationError(error);
  return Boolean(data?.id);
}

/**
 * Marca todas as notificações não lidas da conta atual como lidas.
 * @param {object} options Cliente Supabase.
 * @returns {Promise<number>} Quantidade de registros atualizados.
 */
export async function markAllNotificationsRead({client}={}) {
  const user=await currentUser(client);
  const {data,error}=await client.from("customer_notifications")
    .update({read_at:new Date().toISOString()})
    .eq("auth_user_id",user.id).is("read_at",null).select("id");
  if(error)throw mapNotificationError(error);
  return Array.isArray(data)?data.length:0;
}
