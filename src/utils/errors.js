/**
 * SALÃO PREMIUM — tratamento centralizado de erros.
 * Responsabilidade: converter falhas técnicas em mensagens seguras, registrar contexto
 * sanitizado para diagnóstico e capturar erros globais sem interromper a aplicação.
 */
import { toast } from "../utils.js";

let sequence = 0;
let installed = false;

/** Normaliza o código PostgreSQL/PostgREST ou o status HTTP recebido. */
function errorCode(error) {
  return String(error?.code || error?.status || "").toUpperCase();
}

/** Traduz falhas conhecidas e nunca expõe detalhes técnicos desconhecidos ao usuário. */
export function userErrorMessage(error, fallback = "Não foi possível concluir esta operação. Tente novamente.") {
  const code = errorCode(error);
  if (code === "23505") return "Este registro já existe. Confira os dados informados.";
  if (code === "23503") return "Não foi possível concluir porque este registro está vinculado a outros dados.";
  if (code === "23502") return "Preencha todos os campos obrigatórios.";
  if (code === "23514") return "Os dados informados não atendem às regras deste cadastro.";
  if (code === "22P02" || code === "22003") return "Confira o formato e os valores informados.";
  if (code === "40001" || code === "40P01") return "A operação coincidiu com outra alteração. Atualize os dados e tente novamente.";
  if (code === "57014" || code === "408" || code === "504") return "A operação demorou mais que o esperado. Verifique sua conexão e tente novamente.";
  if (code === "429") return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (["401", "403", "42501", "PGRST301"].includes(code)) return "Sua sessão pode ter expirado ou você não tem permissão para realizar esta operação.";
  if (code === "PGRST116") return "O registro não foi encontrado ou não está disponível.";
  if (["PGRST202", "PGRST205", "42P01", "42703"].includes(code)) return "O banco de dados não está com a estrutura esperada. Entre em contato com o suporte do sistema.";
  if (/^5\d{2}$/.test(code)) return "O serviço está temporariamente indisponível. Tente novamente em alguns instantes.";

  const raw = String(error?.message || error || "").trim();
  if (/invalid login credentials|invalid email or password/i.test(raw)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(raw)) return "Confirme seu e-mail antes de entrar.";
  if (/user already registered|already been registered/i.test(raw)) return "Este e-mail já possui cadastro.";
  if (/password should be at least|password is too short/i.test(raw)) return "A senha não atende ao tamanho mínimo exigido.";
  if (/email rate limit|rate limit exceeded|too many requests/i.test(raw)) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (/refresh token.*(not found|invalid)|invalid.*refresh token|session.*not found/i.test(raw)) return "Sua sessão expirou. Entre novamente no sistema.";
  if (/user not found/i.test(raw)) return "Não encontramos uma conta com esses dados.";
  if (/forbidden|not authorized|permission denied/i.test(raw)) return "Você não tem permissão para realizar esta operação.";
  if (/fetch|network|timeout|failed to fetch|load failed|networkerror/i.test(raw)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  // Mensagens de domínio em português podem ser exibidas; mensagens técnicas desconhecidas ficam ocultas.
  const safePortuguese = raw && raw.length <= 180 &&
    /[ãõáéíóúâêôç]|\b(não|nao|informe|selecione|escolha|preencha|confira|inválid|inval|permissão|comanda|profissional|registro|saldo|horário|serviço|pagamento|estoque|cancelad|encontrad|já existe|já foi)\b/i.test(raw) &&
    !/sql|postgres|supabase|jwt|token|policy|stack| at /i.test(raw);
  return safePortuguese ? raw : fallback;
}

/**
 * Registra um erro com identificador de suporte e contexto sanitizado.
 * Não registrar o objeto bruto, dados pessoais, senhas, tokens ou conteúdo de formulários.
 * @param {unknown} error Falha original recebida do navegador, Supabase ou regra de negócio.
 * @param {{context?: string, notify?: boolean, fallback?: string}} options Contexto e comportamento da notificação.
 * @returns {{id: string, message: string}} Identificador pesquisável e mensagem segura.
 */
export function reportError(error, { context = "Aplicação", notify = true, fallback } = {}) {
  const id = "SP-" + Date.now().toString(36).toUpperCase() + "-" + (++sequence).toString().padStart(3, "0");
  const message = userErrorMessage(error, fallback);
  console.error("[SALAO PREMIUM][" + id + "]", {
    context,
    name: String(error?.name || "Error"),
    code: errorCode(error) || null,
    message
  });
  if (notify && typeof document !== "undefined" && document.body) {
    toast(message + " (Código " + id + ")");
  }
  return { id, message };
}

/** Instala uma única vez os ouvintes globais; pode ser chamada em ambientes sem DOM. */
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  installed = true;

  window.addEventListener("unhandledrejection", event => {
    reportError(event.reason, { context: "Promise não tratada" });
  });

  window.addEventListener("error", event => {
    // Erros de carregamento de imagens/recursos não devem gerar alertas genéricos.
    if (event.error) reportError(event.error, { context: "Erro JavaScript global" });
  });
}
