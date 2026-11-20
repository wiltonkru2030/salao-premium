/**
 * Utilitários legados de cadastro por marca desativados.
 * A identidade atual é global e não utiliza organizationSlug nem data de nascimento
 * como chave de autenticação ou critério automático de associação.
 */
export function normalizeCustomerName() {
  throw new Error("O cadastro legado por salão foi desativado. Utilize o perfil global.");
}
export function normalizeOrganizationSlug() {
  throw new Error("O vínculo com salões será realizado pelo fluxo global seguro.");
}
export function validateBirthDate() {
  throw new Error("Data de nascimento não é método de autenticação nem prova de identidade.");
}
export function validateCustomerProfile() {
  throw new Error("O cadastro por marca foi desativado em favor da identidade global.");
}
