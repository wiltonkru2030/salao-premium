import assert from "node:assert/strict";
import {
  normalizeCustomerPhone,
  formatCustomerPhoneInput,
  formatCustomerPhoneDisplay,
  normalizeGlobalCustomerName,
  normalizeTenantSlug,
  validateGlobalCustomerProfile
} from "./customer-profile-utils.js";

assert.equal(normalizeGlobalCustomerName("  Ana   Maria "), "Ana Maria");
assert.equal(normalizeCustomerPhone("(67) 99999-1234"), "+5567999991234");
assert.equal(normalizeCustomerPhone("+1 (415) 555-2671"), "+14155552671");
assert.equal(normalizeCustomerPhone(""), null);
assert.equal(normalizeTenantSlug("  Studio-Maos-de-Fadas "), "studio-maos-de-fadas");
// Slugs são ASCII intencionalmente; acentos são rejeitados para evitar aliases ambíguos.
assert.throws(() => normalizeTenantSlug("salão"), /link do salão é inválido/);
assert.throws(() => normalizeCustomerPhone("123"), /DDD/);
assert.throws(() => normalizeCustomerPhone("abc"), /telefone informado/);
assert.throws(() => normalizeCustomerPhone("+00012345678"), /formato internacional/);
assert.throws(() => normalizeGlobalCustomerName("A"), /nome/);
assert.throws(() => validateGlobalCustomerProfile({ fullName: "Ana", email: "email-invalido" }), /e-mail/);
assert.throws(() => validateGlobalCustomerProfile({ fullName: "Ana", avatarUrl: "http://example.com/a.png" }), /HTTPS/);

const profile = validateGlobalCustomerProfile({
  fullName: "  Ana   Maria ",
  phone: "67999991234",
  email: " ANA@EXAMPLE.COM ",
  avatarUrl: "https://cdn.example.com/avatar.png"
});
assert.deepEqual(profile, {
  fullName: "Ana Maria",
  phoneE164: "+5567999991234",
  email: "ana@example.com",
  avatarUrl: "https://cdn.example.com/avatar.png"
});

assert.equal(formatCustomerPhoneInput("67999991234"), "(67) 99999-1234");
assert.equal(formatCustomerPhoneInput("6799991234"), "(67) 9999-1234");
assert.equal(formatCustomerPhoneDisplay("+5567999991234"), "(67) 99999-1234");
assert.equal(formatCustomerPhoneDisplay(null), "");
assert.equal(formatCustomerPhoneInput("+1 (415) 555-2671"),"+14155552671");
assert.equal(formatCustomerPhoneInput("+5567999991234"),"+5567999991234");
console.log("Testes de perfil global da cliente: OK");
