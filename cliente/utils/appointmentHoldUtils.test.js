import assert from "node:assert/strict";
import {
  validateHoldId,
  validateHoldInput,
  normalizeCreatedHold
} from "./appointmentHoldUtils.js";

const orgId="a1b2c3d4-e5f6-4789-8123-123456789abc";
const branchId="b1b2c3d4-e5f6-4789-8123-123456789abc";
const professionalId="c1b2c3d4-e5f6-4789-8123-123456789abc";
const serviceId="d1b2c3d4-e5f6-4789-8123-123456789abc";
const holdId="e1b2c3d4-e5f6-4789-8123-123456789abc";

assert.equal(validateHoldId(holdId), holdId);
assert.throws(()=>validateHoldId("abc"),/identificador.*inválido/i);
const input=validateHoldInput({
  orgId,branchId,professionalId,serviceId,startsAt:"2099-05-01T12:00:00.000Z"
});
assert.equal(input.orgId,orgId);
assert.equal(input.startsAt,"2099-05-01T12:00:00.000Z");
assert.throws(()=>validateHoldInput({...input,serviceId:"bad"}),/dados.*inválidos/i);
assert.throws(()=>validateHoldInput({...input,startsAt:"ontem"}),/data e um horário válidos/i);
assert.throws(()=>validateHoldInput({...input,startsAt:"2000-01-01T00:00:00.000Z"}),/horário futuro/i);
const hold=normalizeCreatedHold({hold_id:holdId,expires_at:"2099-05-01T12:05:00.000Z"});
assert.deepEqual(hold,{holdId,expiresAt:"2099-05-01T12:05:00.000Z"});
assert.throws(()=>normalizeCreatedHold({hold_id:holdId,expires_at:"inválido"}),/prazo.*inválido/i);
console.log("Testes de validação do serviço de reserva temporária concluídos.");
