/**
 * Módulo: termsService.js
 * Responsabilidade: consultar documentos legais e registrar aceite explícito.
 * O registro depende de tabela/RPC auditável e não é simulado localmente.
 */
function notReady() {
  const error = new Error("Os documentos e o registro de aceite serão disponibilizados antes da abertura do aplicativo.");
  error.code = "TERMS_SERVICE_NOT_READY";
  return error;
}
export async function getCurrentTerms() { throw notReady(); }
export async function recordExplicitAcceptance() { throw notReady(); }
