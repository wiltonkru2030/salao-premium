/**
 * Cliente HTTP mínimo para os testes de integração do SALÃO PREMIUM.
 * Responsabilidade: autenticar usuários reais e chamar PostgREST/Auth/RPC sem dependências externas.
 * Segurança: a chave service_role é lida somente do ambiente do terminal e usada apenas para
 * provisionar e remover contas de teste; nunca é enviada ao navegador nem gravada em arquivo.
 */
const URL_BASE = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertEnvironment() {
  const missing = [["SUPABASE_URL", URL_BASE], ["SUPABASE_PUBLISHABLE_KEY", ANON], ["SUPABASE_SERVICE_ROLE_KEY", SERVICE]]
    .filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error("Variáveis ausentes para o teste de integração: " + missing.join(", "));
}

async function request(path, { method = "GET", token, apiKey = ANON, body, prefer } = {}) {
  const headers = { apikey: apiKey, "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(URL_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data, error: response.ok ? null : (data?.message || data?.msg || data?.error_description || text) };
}

/** Operações administrativas (somente provisionamento/limpeza de contas de teste). */
export const admin = {
  createUser: (email, password, metadata = {}) => request("/auth/v1/admin/users", {
    method: "POST", apiKey: SERVICE, token: SERVICE,
    body: { email, password, email_confirm: true, user_metadata: metadata }
  }),
  deleteUser: id => request("/auth/v1/admin/users/" + id, { method: "DELETE", apiKey: SERVICE, token: SERVICE }),
  insert: (table, row) => request("/rest/v1/" + table, { method: "POST", apiKey: SERVICE, token: SERVICE, body: row, prefer: "return=representation" }),
  update: (table, filter, row) => request("/rest/v1/" + table + "?" + filter, { method: "PATCH", apiKey: SERVICE, token: SERVICE, body: row, prefer: "return=representation" }),
  select: (table, query) => request("/rest/v1/" + table + "?" + query, { apiKey: SERVICE, token: SERVICE }),
  remove: (table, filter) => request("/rest/v1/" + table + "?" + filter, { method: "DELETE", apiKey: SERVICE, token: SERVICE })
};

/** Sessão de um usuário autenticado; todas as chamadas passam por RLS. */
export async function signIn(email, password) {
  const result = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (!result.ok) throw new Error("Falha no login de teste (" + email + "): " + result.error);
  const token = result.data.access_token;
  return {
    userId: result.data.user.id,
    token,
    select: (table, query = "select=*") => request("/rest/v1/" + table + "?" + query, { token }),
    insert: (table, row) => request("/rest/v1/" + table, { method: "POST", token, body: row, prefer: "return=representation" }),
    update: (table, filter, row) => request("/rest/v1/" + table + "?" + filter, { method: "PATCH", token, body: row, prefer: "return=representation" }),
    remove: (table, filter) => request("/rest/v1/" + table + "?" + filter, { method: "DELETE", token, prefer: "return=representation" }),
    rpc: (name, args = {}) => request("/rest/v1/rpc/" + name, { method: "POST", token, body: args })
  };
}