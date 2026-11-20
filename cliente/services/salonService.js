/**
 * Módulo: salonService.js
 * Responsabilidade: contrato de leitura da vitrine pública de salões e filiais.
 * A consulta fica bloqueada até existir diretório público com campos explicitamente aprovados.
 */
export async function searchSalons() {
  const error = new Error("O catálogo de salões ainda não está disponível. Tente novamente em breve.");
  error.code = "SALON_DIRECTORY_NOT_READY";
  throw error;
}
export async function getSalonProfile() {
  const error = new Error("A vitrine deste salão ainda não está disponível.");
  error.code = "SALON_PROFILE_NOT_READY";
  throw error;
}
