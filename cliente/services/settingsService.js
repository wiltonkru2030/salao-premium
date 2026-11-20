/**
 * Módulo: settingsService.js
 * Responsabilidade: preferências locais não sensíveis do aplicativo.
 * Dados locais não substituem autorização do backend nem armazenamento seguro nativo.
 */
const STORAGE_KEY = "salao-premium:client-settings:v1";
const DEFAULTS = Object.freeze({
  theme: "system",
  reminders: true,
  appointmentChanges: true,
  coupons: true,
  promotions: false,
  defaultCity: null,
  defaultNeighborhood: null
});

export function getLocalSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveLocalSettings(patch = {}) {
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
  const next = { ...getLocalSettings(), ...allowed };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
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
