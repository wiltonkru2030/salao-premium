import assert from "node:assert/strict";
import { customerAuthError, safeClientRedirect } from "./auth-utils.js";

assert.match(customerAuthError({ code: "passkey_disabled" }), /ainda não foi habilitada/i);
assert.match(customerAuthError({ code: "webauthn_challenge_expired" }), /demorou muito/i);
assert.match(customerAuthError({ message: "Failed to fetch" }), /internet/i);
assert.equal(safeClientRedirect("https://exemplo.com"), "https://exemplo.com/cliente/");
assert.throws(() => safeClientRedirect("https://exemplo.com", "https://malicioso.com"));
console.log("Testes da autenticação do cliente concluídos.");