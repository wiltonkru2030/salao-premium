/**
 * Testes unitários do tradutor central de erros.
 * Valida que falhas comuns sejam apresentadas em pt-BR e detalhes técnicos não vazem.
 */
import assert from "node:assert/strict";
import { userErrorMessage } from "./errors.js";

const cases = [
  [{ code: "23505", message: "duplicate key value violates unique constraint" }, "Este registro já existe. Confira os dados informados."],
  [{ code: "23503" }, "Não foi possível concluir porque este registro está vinculado a outros dados."],
  [{ code: "42501" }, "Você não tem permissão para realizar esta operação."],
  [{ code: "PGRST116" }, "O registro não foi encontrado ou não está disponível."],
  [{ code: "23514" }, "Os dados informados não atendem às regras deste cadastro."],
  [{ message: "Invalid login credentials" }, "E-mail ou senha incorretos."],
  [{ message: "Email not confirmed" }, "Confirme seu e-mail antes de entrar."],
  [{ message: "Failed to fetch" }, "Falha de conexão. Verifique sua internet e tente novamente."],
  [{ message: "permission denied for table service_orders" }, "Você não tem permissão para realizar esta operação."]
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

process.stdout.write("Testes de tratamento de erros: OK\n");
