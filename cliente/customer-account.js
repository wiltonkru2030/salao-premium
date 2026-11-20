/**
 * Serviço legado desativado.
 * A implementação anterior criava uma conta por organização (customer_accounts),
 * contrariando a decisão de identidade global. Não chamar register_customer_account.
 * O fluxo será substituído por customer_profiles + memberships após migration e RLS.
 */
export async function registerCustomerAccount() {
  const error = new Error("O cadastro antigo por salão foi desativado. A conta global está em implantação.");
  error.code = "LEGACY_CUSTOMER_FLOW_DISABLED";
  throw error;
}
export async function getMyCustomerAccount() {
  const error = new Error("A consulta antiga por salão foi desativada. Use o perfil global após a migração.");
  error.code = "LEGACY_CUSTOMER_FLOW_DISABLED";
  throw error;
}
