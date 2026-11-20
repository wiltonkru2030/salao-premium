/**
 * Testes de renderização do perfil global da cliente.
 * Responsabilidade: validar máscara, conteúdo essencial e escape contra HTML injetado.
 * Ecossistema: Área da Cliente do SALÃO PREMIUM.
 */
import assert from "node:assert/strict";
import { renderCustomerProfileView } from "./customerProfileView.js";

const html = renderCustomerProfileView({
  profile: {
    fullName: "<img src=x onerror=alert(1)>",
    email: "cliente@example.com",
    phone: "+5567999991234"
  },
  session: { user: { user_metadata: {} } },
  theme: "system"
});
assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
assert.ok(!html.includes("<img src=x"));
assert.ok(html.includes("(67) 99999-1234"));
assert.ok(html.includes('data-profile-form'));
assert.ok(html.includes('name="fullName"'));
assert.ok(html.includes('name="phone"'));
assert.ok(html.includes("não é considerado verificado"));
assert.ok(!html.includes("migration e os testes RLS"));
console.log("Testes de renderização do perfil global da cliente: OK");
