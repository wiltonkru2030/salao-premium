import { formatPhone, formatInternationalPhone } from "../src/utils/input-masks.js";
/**
 * Valida dados do perfil global da cliente sem acessar rede ou autenticação.
 * Telefone é apenas dado de contato: esta função nunca o marca como verificado.
 */

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeGlobalCustomerName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) {
    throw new Error("Informe seu nome (de 2 a 120 caracteres).");
  }
  return name;
}

/**
 * Normaliza um telefone para E.164.
 * Números nacionais brasileiros sem DDI recebem +55; números internacionais
 * devem informar o DDI. A saída não representa verificação de posse.
 */
export function normalizeCustomerPhone(value, defaultCountryCode = "55") {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\+?(?:\d|\()[\d\s().-]*$/.test(raw)) {
    throw new Error("Confira o telefone informado.");
  }

  const digits = raw.replace(/\D/g, "");
  let international;
  if (raw.startsWith("+")) {
    international = `+${digits}`;
  } else if (defaultCountryCode === "55" && (digits.length === 10 || digits.length === 11)) {
    international = `+55${digits}`;
  } else if (digits.length >= 8 && digits.length <= 15) {
    international = `+${digits}`;
  } else {
    throw new Error("Informe o telefone com DDD e código do país quando necessário.");
  }

  if (!E164_PATTERN.test(international)) {
    throw new Error("O telefone precisa estar no formato internacional válido.");
  }
  return international;
}

export function normalizeTenantSlug(value) {
  const slug = String(value ?? "").trim().toLowerCase();
  if (slug.length > 80 || !SLUG_PATTERN.test(slug)) {
    throw new Error("O link do salão é inválido. Confira o endereço e tente novamente.");
  }
  return slug;
}

/**
 * Monta perfil global. E-mail e telefone são contatos, não credenciais.
 * phone_verified_at não pode ser definido por dados enviados pelo cliente.
 */
export function validateGlobalCustomerProfile({ fullName, phone = null, email = null, avatarUrl = null } = {}) {
  const normalizedEmail = email == null || String(email).trim() === ""
    ? null
    : String(email).trim().toLowerCase();
  if (normalizedEmail && (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))) {
    throw new Error("Confira o e-mail informado.");
  }

  let normalizedAvatar = null;
  if (avatarUrl != null && String(avatarUrl).trim() !== "") {
    try {
      const parsed = new URL(String(avatarUrl));
      if (parsed.protocol !== "https:") throw new Error("invalid");
      normalizedAvatar = parsed.toString();
    } catch {
      throw new Error("A foto precisa ter um endereço HTTPS válido.");
    }
  }

  return {
    fullName: normalizeGlobalCustomerName(fullName),
    phoneE164: normalizeCustomerPhone(phone),
    email: normalizedEmail,
    avatarUrl: normalizedAvatar
  };
}


/**
 * Formata telefone brasileiro durante a digitação, sem armazenar pontuação.
 * @param {string} value Valor digitado.
 * @returns {string} Telefone visual com DDD, limitado a onze dígitos.
 */
export function formatCustomerPhoneInput(value) {
  return formatInternationalPhone(value);
}

/**
 * Apresenta um telefone E.164 em máscara brasileira quando o DDI for +55.
 * @param {string|null} value Telefone armazenado.
 * @returns {string} Telefone pronto para exibição.
 */
export function formatCustomerPhoneDisplay(value) {
  if (!value) return "";
  const normalized = String(value);
  return normalized.startsWith("+55")
    ? formatPhone(normalized)
    : normalized;
}
