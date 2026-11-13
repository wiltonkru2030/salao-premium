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
  if (code === "23514") return "Os dados informados não atendem às regras deste cadastro.";
  if (code === "22P02" || code === "22003") return "Confira o formato e os valores informados.";
  if (code === "40001" || code === "40P01") return "A operação coincidiu com outra alteração. Atualize os dados e tente novamente.";
  if (code === "57014") return "A operação demorou mais que o esperado. Tente novamente.";
  if (code === "42501" || code === "401" || code === "403" || code === "PGRST301") return "Sua sessão pode ter expirado ou você não tem permissão para realizar esta operação.";
  if (code === "PGRST116") return "O registro não foi encontrado ou não está disponível.";
  const raw = String(error?.message || error || "").trim();
  if (/invalid login credentials|invalid email or password/i.test(raw)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(raw)) return "Confirme seu e-mail antes de entrar.";
  if (/user already registered|already been registered/i.test(raw)) return "Este e-mail já possui cadastro.";
  if (/password should be at least|password is too short/i.test(raw)) return "A senha não atende ao tamanho mínimo exigido.";
  if (/email rate limit|rate limit exceeded|too many requests/i.test(raw)) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (/refresh token.*(not found|invalid)|invalid.*refresh token|session.*not found/i.test(raw)) return "Sua sessão expirou. Entre novamente no sistema.";
  if (/user not found/i.test(raw)) return "Não encontramos uma conta com esses dados.";
  if (/forbidden|not authorized|permission denied/i.test(raw)) return "Você não tem permissão para realizar esta operação.";
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
  // O console recebe metadados sanitizados; o objeto bruto pode conter dados pessoais.
  console.error("[SALAO PREMIUM][" + id + "]", {
    context,
    name: String(error?.name || "Error"),
    code: errorCode(error) || null,
    message: userErrorMessage(error, fallback)
  });
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
