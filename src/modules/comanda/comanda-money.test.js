/** Testes de precisão monetária e validação dos itens. */
import assert from "node:assert/strict";
import {calculateComandaItemTotal as total} from "./comanda-money.js";
assert.equal(total(3,0.1),0.3);
assert.equal(total(3,19.99,0.01),59.96);
assert.throws(()=>total(1,10,11));
assert.throws(()=>total(1,0.001));
assert.throws(()=>total(0,10));
console.log("Testes monetários da Comanda: OK.");
