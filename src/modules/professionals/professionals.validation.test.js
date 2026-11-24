/**
 * Testes de normalização e validação fiscal com documentos de exemplo.
 */
import assert from "node:assert/strict";
import {onlyDigits,validCpf,validCnpj} from "./professionals.validation.js";
assert.equal(onlyDigits("529.982.247-25"),"52998224725");
assert.equal(onlyDigits(null),"");
assert.equal(validCpf("529.982.247-25"),true);
assert.equal(validCpf("529.982.247-26"),false);
assert.equal(validCpf("111.111.111-11"),false);
assert.equal(validCnpj("04.252.011/0001-10"),true);
assert.equal(validCnpj("04.252.011/0001-11"),false);
assert.equal(validCnpj("00.000.000/0000-00"),false);
assert.equal(validCnpj("12.abc.345/01de-35"),true);
assert.equal(validCnpj("12.ABC.345/01DE-36"),false);
assert.equal(validCnpj("12.ABC.345/01DE-B5"),false);
assert.equal(validCnpj("12#ABC34501DE35"),false);
console.log("Testes de validação fiscal: OK.");
