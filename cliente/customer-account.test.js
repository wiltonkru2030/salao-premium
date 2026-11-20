import assert from "node:assert/strict";
import { normalizeCustomerName, normalizeOrganizationSlug, validateBirthDate, validateCustomerProfile } from "./customer-account-utils.js";
assert.throws(() => normalizeCustomerName("Maria"), /cadastro legado por salão foi desativado/i);
assert.throws(() => normalizeOrganizationSlug("studio-beleza"), /vínculo com salões/i);
assert.throws(() => validateBirthDate("1980-02-29"), /não é método de autenticação/i);
assert.throws(() => validateCustomerProfile({}), /identidade global/i);
console.log("Fluxo legado por marca corretamente desativado.");
