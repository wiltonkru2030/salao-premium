/**
 * SALÃO PREMIUM — tratamento centralizado de erros.
 * Responsabilidade: converter erros técnicos em mensagens seguras, registrar contexto
 * para diagnóstico e impedir rejeições assíncronas sem tratamento.
 */
import { toast } from "../utils.js";

let sequence = 0;
let installed = false;

function errorCode(error) {
  return String(error?.code || error?.status || "").toUpperCase();
}

/** Retorna uma mensagem adequada ao usuário sem expor SQL, tokens ou detalhes internos. */
export function userErrorMessage(error, fallback = "Não foi possível concluir esta operação. Tente novamente.") {
  const code = errorCode(error);
  if (code === "23505") return "Este registro já existe. Confira os dados informados.";
  if (code === "23503") return "Não foi possível concluir porque este registro está vinculado a outros dados.";
  if (code === "23502") return "Preencha todos os campos obrigatórios.";
  if (code === "42501" || code === "401" || code === "403") return "Você não tem permissão para realizar esta operação.";
  if (code === "PGRST116") return "O registro não foi encontrado ou não está disponível.";
  const raw = String(error?.message || error || "").trim();
  if (/invalid login credentials|invalid email or password/i.test(raw)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(raw)) return "Confirme seu e-mail antes de entrar.";
  if (/user already registered|already been registered/i.test(raw)) return "Este e-mail já possui cadastro.";
  if (/password should be at least|password is too short/i.test(raw)) return "A senha não atende ao tamanho mínimo exigido.";
  if (/email rate limit|rate limit exceeded/i.test(raw)) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (/fetch|network|timeout|failed to fetch|load failed/i.test(raw)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  // Mensagens de domínio escritas em português podem ser mostradas; mensagens técnicas
  // desconhecidas (frequentemente em inglês) permanecem ocultas para não confundir o usuário.
  const safePortuguese = raw && raw.length <= 180 &&
    /[ãõáéíóúâêôç]|\b(não|nao|informe|selecione|escolha|preencha|confira|inválid|inval|permissão|comanda|profissional|registro|saldo|horário|serviço|pagamento|estoque|cancelad|encontrad|já existe|já foi)\b/i.test(raw) &&
    !/sql|postgres|supabase|jwt|token|policy|stack| at /i.test(raw);
  if (safePortuguese) return raw;
  return fallback;
}

/**
 * Registra erro com identificador pesquisável no console e, por padrão,
 * mostra uma mensagem segura ao usuário. Não registrar dados pessoais/senhas.
 */
export function reportError(error, { context = "Aplicação", notify = true, fallback } = {}) {
  const id = "SP-" + Date.now().toString(36).toUpperCase() + "-" + (++sequence).toString().padStart(3, "0");
  console.error("[SALAO PREMIUM][" + id + "][" + context + "]", error);
  if (notify && document.body) {
    const message = userErrorMessage(error, fallback);
    toast(message + " (Código " + id + ")");
  }
  return { id, message: userErrorMessage(error, fallback) };
}

/** Instala uma única vez a captura de erros assíncronos não tratados. */
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  window.addEventListener("unhandledrejection", event => {
    reportError(event.reason, { context: "Promise não tratada" });
  });

  window.addEventListener("error", event => {
    // Erros de carregamento de imagens/recursos não devem gerar alertas genéricos.
    if (event.error) reportError(event.error, { context: "Erro JavaScript global" });
  });
}
