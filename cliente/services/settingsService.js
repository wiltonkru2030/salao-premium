/**
 * Módulo: settingsService.js
 * Responsabilidade: preferências locais não sensíveis do aplicativo.
 * Dados locais não substituem autorização do backend nem armazenamento seguro nativo.
 */
const STORAGE_PREFIX = "salao-premium:client-settings:v2:";
let accountScope = "guest";

/** Isola preferências por conta; não reaproveita a cidade de outra cliente no mesmo aparelho. */
export function setSettingsAccount(userId = null) {
  accountScope = typeof userId === "string" && userId.trim() ? encodeURIComponent(userId) : "guest";
}
function storageKey() { return STORAGE_PREFIX + accountScope; }
const DEFAULTS = Object.freeze({
  theme: "system",
  reminders: true,
  appointmentChanges: true,
  coupons: true,
  promotions: false,
  defaultCity: null,
  defaultNeighborhood: null
});

/** Filtra preferências locais e remotas, rejeitando chaves desconhecidas e tipos inválidos. */
export function sanitizeSettings(patch={}) {
  if(!patch||typeof patch!=="object"||Array.isArray(patch))return {};
  const allowed = {};
  if (["system", "light", "dark"].includes(patch.theme)) allowed.theme = patch.theme;
  for (const key of ["reminders", "appointmentChanges", "coupons", "promotions"]) {
    if (typeof patch[key] === "boolean") allowed[key] = patch[key];
  }
  for (const key of ["defaultCity", "defaultNeighborhood"]) {
    if (patch[key] === null || typeof patch[key] === "string") {
      const value = patch[key] === null ? null : patch[key].trim().slice(0, 100);
      allowed[key] = value || null;
    }
  }
  return allowed;
}

/** Lê exclusivamente preferências válidas da conta ativa. */
export function getLocalSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey());
    const stored = raw ? JSON.parse(raw) : {};
    return { ...DEFAULTS, ...sanitizeSettings(stored) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveLocalSettings(patch = {}) {
  const allowed = sanitizeSettings(patch);
  const next = { ...getLocalSettings(), ...allowed };
  try {
    if (!globalThis.localStorage) throw new Error("storage-unavailable");
    globalThis.localStorage.setItem(storageKey(), JSON.stringify(next));
  } catch {
    throw new Error("Não foi possível salvar as preferências neste aparelho.");
  }
  return next;
}

export function clearTemporaryCache() {
  // Remove apenas chaves temporárias explicitamente reservadas ao app; não limpa sessão Auth.
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("salao-premium:cache:")) localStorage.removeItem(key);
    }
  } catch {
    throw new Error("Não foi possível limpar os dados temporários.");
  }
}


/**
 * Consulta preferências remotas sincronizadas entre aparelhos.
 * @param {object} options Cliente Supabase autenticado.
 * @returns {Promise<object>} Preferências autorizadas pelo perfil global.
 */
export async function getRemoteSettings({client}={}) {
  if(!client||typeof client.rpc!=="function")throw new TypeError("A conexão das preferências não está disponível.");
  const {data,error}=await client.rpc("get_my_customer_preferences");
  if(error)throw new Error(["PGRST202","42883"].includes(error.code)
    ?"A sincronização das preferências ainda está sendo ativada."
    :"Não foi possível carregar suas preferências.");
  return sanitizeSettings(data);
}

/**
 * Salva somente as preferências permitidas no perfil global.
 * @param {object} options Cliente Supabase e alterações de preferências.
 * @returns {Promise<object>} Preferências persistidas.
 */
export async function saveRemoteSettings({client,patch={}}={}) {
  if(!client||typeof client.rpc!=="function")throw new TypeError("A conexão das preferências não está disponível.");
  const {data,error}=await client.rpc("update_my_customer_preferences",{p_preferences:sanitizeSettings(patch)});
  if(error)throw new Error(["PGRST202","42883"].includes(error.code)
    ?"A sincronização das preferências ainda está sendo ativada."
    :"Não foi possível salvar suas preferências.");
  return sanitizeSettings(data);
}
