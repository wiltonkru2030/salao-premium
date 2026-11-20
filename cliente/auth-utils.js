/** Utilitários puros do acesso do cliente; não armazenam credenciais nem dados pessoais. */
export function customerAuthError(error) {
  const code = String(error?.code || error?.error_code || "");
  const message = String(error?.message || "").toLowerCase();
  if (code === "passkey_disabled") return "A chave de acesso ainda não foi habilitada no SALÃO PREMIUM. Use o Google enquanto a configuração é concluída.";
  if (code === "webauthn_credential_not_found") return "Não encontramos uma chave de acesso cadastrada neste aparelho. Entre com Google e cadastre uma chave.";
  if (code === "webauthn_challenge_expired") return "A confirmação demorou muito. Tente novamente.";
  if (code === "email_not_confirmed" || code === "phone_not_confirmed") return "É necessário confirmar sua conta antes de usar a chave de acesso.";
  if (message.includes("cancel")) return "A operação foi cancelada.";
  if (message.includes("network") || message.includes("fetch")) return "Não foi possível conectar. Confira sua internet e tente novamente.";
  return "Não foi possível concluir o acesso. Tente novamente ou escolha outra forma de entrar.";
}

export function safeClientRedirect(origin, pathname = "/cliente/") {
  const base = new URL(pathname, origin);
  if (base.origin !== origin) throw new Error("Destino de retorno inválido.");
  return base.toString();
}