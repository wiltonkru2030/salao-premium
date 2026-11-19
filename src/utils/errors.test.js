/**
 * Testes unitários do tradutor central de erros.
 * Valida erros PostgreSQL, HTTP, autenticação, conexão e proteção contra vazamento técnico.
 */
import assert from "node:assert/strict";
import { userErrorMessage } from "./errors.js";

const cases = [
  [{ code: "23505", message: "duplicate key value violates unique constraint" }, "Este registro já existe. Confira os dados informados."],
  [{ code: "23503" }, "Não foi possível concluir porque este registro está vinculado a outros dados."],
  [{ code: "42501" }, "Sua sessão pode ter expirado ou você não tem permissão para realizar esta operação."],
  [{ code: "PGRST116" }, "O registro não foi encontrado ou não está disponível."],
  [{ code: "23514" }, "Os dados informados não atendem às regras deste cadastro."],
  [{ message: "Invalid login credentials" }, "E-mail ou senha incorretos."],
  [{ message: "Email not confirmed" }, "Confirme seu e-mail antes de entrar."],
  [{ message: "Failed to fetch" }, "Falha de conexão. Verifique sua internet e tente novamente."],
  [{ message: "permission denied for table service_orders" }, "Você não tem permissão para realizar esta operação."],
  [{ status: 429 }, "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."],
  [{ status: 408 }, "A operação demorou mais que o esperado. Verifique sua conexão e tente novamente."],
  [{ status: 504 }, "A operação demorou mais que o esperado. Verifique sua conexão e tente novamente."],
  [{ status: 503 }, "O serviço está temporariamente indisponível. Tente novamente em alguns instantes."],
  [{ message: "NetworkError when attempting to fetch resource" }, "Falha de conexão. Verifique sua internet e tente novamente."]
];

for (const [error, expected] of cases) {
  assert.equal(userErrorMessage(error), expected);
}

assert.equal(
  userErrorMessage({ message: "duplicate key violates unique constraint" }),
  "Não foi possível concluir esta operação. Tente novamente.",
  "Mensagem técnica em inglês não deve aparecer crua."
);
assert.equal(
  userErrorMessage({ message: "Falha: horário já reservado para este profissional." }),
  "Falha: horário já reservado para este profissional.",
  "Mensagem de domínio em português deve ser preservada."
);
assert.equal(
  userErrorMessage({ message: "JWT invalid: eyJhbGciOi..." }),
  "Não foi possível concluir esta operação. Tente novamente.",
  "Tokens e detalhes de autenticação não devem vazar."
);

process.stdout.write("Testes de tratamento de erros: OK (" + cases.length + " cenários)\n");
