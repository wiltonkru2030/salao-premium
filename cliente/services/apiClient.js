/**
 * Módulo: apiClient.js
 * Responsabilidade: centralizar chamadas HTTP e padronizar falhas de rede.
 * Fluxo: valida URL/opções, aplica timeout, interpreta JSON com segurança e
 * transforma respostas HTTP inválidas em ApiError sem expor detalhes internos.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "API_ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;
const SAFE_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export async function requestApi(url, options = {}) {
  if (typeof url !== "string" || !url.trim()) {
    throw new ApiError("Endereço da requisição inválido.", { code: "INVALID_URL" });
  }
  const method = String(options.method || "GET").toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    throw new ApiError("Tipo de operação não permitido.", { code: "INVALID_METHOD" });
  }
  const timeoutMs = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new ApiError("Tempo limite da requisição inválido.", { code: "INVALID_TIMEOUT" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal || controller.signal,
      credentials: options.credentials || "same-origin"
    });
    const raw = await response.text();
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); }
      catch {
        if (response.ok) throw new ApiError("O servidor retornou uma resposta inválida.", { status: response.status, code: "INVALID_RESPONSE" });
        data = null;
      }
    }
    if (!response.ok) {
      const status = response.status;
      const code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 409 ? "CONFLICT" : `HTTP_${status}`;
      const messages = {
        400: "Confira os dados informados e tente novamente.",
        401: "Sua sessão expirou. Entre novamente.",
        403: "Você não tem permissão para realizar esta ação.",
        404: "O recurso solicitado não está disponível.",
        409: "Esta informação foi alterada. Atualize a tela e tente novamente.",
        429: "Muitas tentativas. Aguarde um pouco e tente novamente."
      };
      throw new ApiError(messages[status] || "Não foi possível concluir a operação.", { status, code });
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw new ApiError("A operação foi cancelada.", { code: "ABORTED" });
    if (error?.name === "AbortError" || controller.signal.aborted) {
      throw new ApiError("A conexão demorou mais que o esperado. Tente novamente.", { code: "TIMEOUT" });
    }
    throw new ApiError("Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.", { code: "NETWORK_ERROR" });
  } finally {
    clearTimeout(timeoutId);
  }
}
