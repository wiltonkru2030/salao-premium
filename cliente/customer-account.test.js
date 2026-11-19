import assert from "node:assert/strict";
import {
  normalizeCustomerName,
  normalizeOrganizationSlug,
  validateBirthDate,
  validateCustomerProfile
} from "./customer-account.js";

assert.equal(normalizeCustomerName("  Maria   da   Silva "), "Maria da Silva");
assert.equal(normalizeOrganizationSlug(" Studio-Beleza "), "studio-beleza");
assert.equal(validateBirthDate("1980-02-29"), "1980-02-29");
assert.equal(validateBirthDate(""), null);
assert.deepEqual(
  validateCustomerProfile({ organizationSlug: "studio-beleza", fullName: "Maria Silva", birthDate: "1980-02-29" }),
  { organizationSlug: "studio-beleza", fullName: "Maria Silva", birthDate: "1980-02-29" }
);
assert.throws(() => normalizeCustomerName(" "), /nome completo/i);
assert.throws(() => normalizeOrganizationSlug("../outra-marca"), /link do salão/i);
assert.throws(() => validateBirthDate("2025-02-29"), /data de nascimento válida/i);
assert.throws(() => validateBirthDate("2999-01-01"), /data de nascimento válida/i);
assert.throws(() => validateBirthDate("1899-12-31"), /data de nascimento válida/i);
console.log("Testes da identidade de cliente por marca concluídos.");