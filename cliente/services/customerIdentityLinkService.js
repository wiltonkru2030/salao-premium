/**
 * Serviço: customerIdentityLinkService.js
 * Responsabilidade: listar e confirmar solicitações de associação de cadastro legado.
 * A solicitação é criada pela equipe do salão; a cliente só pode confirmar
 * pedidos destinados à identidade autenticada na sessão atual.
 * A RPC do banco é a autoridade final e aplica auth.uid(), expiração e RLS.
 */
import { supabase } from "../../src/supabase/client.js";
import {
  normalizePendingIdentityLinkRequest,
  validateIdentityLinkRequestId
} from "../utils/customerIdentityLinkUtils.js";

function mapIdentityLinkError(error) {
  const code = error?.code;
  if (code === "PGRST202" || code === "42883" || code === "42P01") {
    return new Error("A confirmação de cadastro ainda não está disponível. Tente novamente mais tarde.");
  }
  if (code === "42501" || code === "PGRST301") {
    return new Error("Esta solicitação não pertence à sua conta ou não está mais disponível.");
  }
  if (code === "22023") return new Error("Esta solicitação expirou. Peça ao salão para enviar outra.");
  if (code === "23505") return new Error("Este cadastro já está associado a outra conta.");
  return new Error("Não foi possível processar a confirmação agora. Tente novamente.");
}

/**
 * Lista somente solicitações dirigidas à identidade autenticada.
 * @returns {Promise<Array<object>>} Solicitações com dados mínimos para consentimento.
 */
export async function listMyPendingIdentityLinks() {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Entre na sua conta para consultar solicitações.");
    const { data, error } = await supabase.rpc("get_my_pending_customer_link_requests");
    if (error) throw mapIdentityLinkError(error);
    if (!Array.isArray(data)) throw new Error("A resposta das solicitações está inválida.");
    return data.map(normalizePendingIdentityLinkRequest);
  } catch (error) {
    if (error instanceof TypeError || error.message?.startsWith("Entre na sua conta")) throw error;
    if (error.message?.startsWith("A confirmação") || error.message?.startsWith("Esta solicitação")) throw error;
    throw new Error("Não foi possível carregar suas solicitações. Verifique sua conexão e tente novamente.");
  }
}

/**
 * Confirma uma associação após a cliente conferir o salão e os dados exibidos.
 * O backend confere novamente identidade, status, expiração e unicidade em transação.
 * @param {string} requestId - UUID da solicitação exibida à cliente.
 * @returns {Promise<string>} UUID do cadastro legado associado no salão.
 */
export async function confirmMyIdentityLink(requestId) {
  const id = validateIdentityLinkRequestId(requestId);
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Entre na sua conta para confirmar o vínculo.");
    const { data, error } = await supabase.rpc("confirm_customer_legacy_link", {
      p_request_id: id
    });
    if (error) throw mapIdentityLinkError(error);
    if (typeof data !== "string" || !data) throw new Error("O servidor não confirmou o vínculo.");
    return data;
  } catch (error) {
    if (error instanceof TypeError || error.message?.startsWith("Entre na sua conta")) throw error;
    if (error.message?.startsWith("Esta solicitação") || error.message?.startsWith("Este cadastro")) throw error;
    throw new Error("Não foi possível confirmar o vínculo. Tente novamente.");
  }
}
