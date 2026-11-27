/**
 * Testes unitários das views de autenticação do App Profissional.
 * Responsabilidade: garantir estrutura dos formulários e escape das mensagens.
 * Execução: node professional/views/auth.views.test.js
 */
import assert from "node:assert/strict";
import {
  renderProfessionalLoginView,
  renderProfessionalPasswordChangeView
} from "./auth.views.js";

assert.doesNotMatch(renderProfessionalLoginView(), /data-platform-appearance|data-platform-theme-toggle/);
const login = renderProfessionalLoginView("<script>alert(1)</script>");
assert.match(login, /id="professional-login"/);
assert.match(login, /name="login"/);
assert.match(login, /name="password"/);
assert.doesNotMatch(login, /<script>alert\(1\)<\/script>/);
assert.match(login, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

const password = renderProfessionalPasswordChangeView("Senha inválida");
assert.match(password, /id="professional-password-change"/);
assert.match(password, /minlength="10"/);
assert.match(password, /Senha inválida/);

console.log("Testes das views de autenticação do App Profissional concluídos.");
