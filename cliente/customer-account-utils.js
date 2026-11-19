/**
 * Funções puras para validar os dados de perfil de cliente.
 * Separadas do cliente Supabase para permitir testes locais sem rede.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function normalizeCustomerName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) throw new Error("Informe seu nome completo (de 2 a 120 caracteres).");
  return name;
}
export function normalizeOrganizationSlug(value) {
  const slug = String(value ?? "").trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) throw new Error("O link do salão é inválido. Peça o link correto à recepção.");
  return slug;
}
export function validateBirthDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const birthDate = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new Error("Confira a data de nascimento.");
  const [year, month, day] = birthDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const normalized = parsed.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (normalized !== birthDate || year < 1900 || birthDate > today) throw new Error("Informe uma data de nascimento válida.");
  return birthDate;
}
export function validateCustomerProfile({ organizationSlug, fullName, birthDate = null }) {
  return {
    organizationSlug: normalizeOrganizationSlug(organizationSlug),
    fullName: normalizeCustomerName(fullName),
    birthDate: validateBirthDate(birthDate)
  };
}
