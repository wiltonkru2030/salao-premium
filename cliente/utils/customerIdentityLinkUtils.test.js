import assert from "node:assert/strict";
import {
  normalizePendingIdentityLinkRequest,
  validateIdentityLinkRequestId
} from "./customerIdentityLinkUtils.js";

const requestId = "a1b2c3d4-e5f6-4789-8123-123456789abc";
const orgId = "b1b2c3d4-e5f6-4789-8123-123456789abc";
assert.equal(validateIdentityLinkRequestId(requestId), requestId);
assert.throws(() => validateIdentityLinkRequestId("not-a-uuid"), /solicitação de vínculo inválida/i);
const normalized = normalizePendingIdentityLinkRequest({
  request_id: requestId,
  org_id: orgId,
  salon_name: "Studio Exemplo",
  customer_name: "Maria da Silva",
  phone_suffix: "42",
  expires_at: "2026-11-21T10:00:00.000Z"
});
assert.equal(normalized.requestId, requestId);
assert.equal(normalized.salonName, "Studio Exemplo");
assert.equal(normalized.phoneSuffix, "42");
assert.equal("customer_id" in normalized, false);
assert.throws(() => normalizePendingIdentityLinkRequest({
  request_id: requestId, org_id: orgId, salon_name: "", customer_name: "Maria",
  expires_at: "inválida"
}), /dados da solicitação estão incompletos/i);
assert.throws(() => normalizePendingIdentityLinkRequest({
  request_id: requestId, org_id: orgId, salon_name: "Studio", customer_name: "Maria",
  phone_suffix: "123", expires_at: "2026-11-21T10:00:00.000Z"
}), /telefone.*formato inválido/i);
console.log("Testes dos utilitários de confirmação de identidade concluídos.");
