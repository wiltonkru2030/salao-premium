/** Testes de regressão das máscaras de CPF/CNPJ, telefone, CEP, moeda e login por e-mail. */
import assert from "node:assert/strict";
import { detectInputMask, formatCpf, formatCnpj, formatPhone, formatCep, parseBRL } from "./input-masks.js";

const field=(name,placeholder="",mask="")=>({name,id:"",placeholder,dataset:{mask}});

// CPF/e-mail is a shared login field: the presence of a CPF example must not destroy e-mail input.
assert.equal(detectInputMask(field("login","000.000.000-00 ou e-mail")),"");
assert.equal(detectInputMask(field("cpf")),"cpf");
assert.equal(detectInputMask(field("document","000.000.000-00")),"cpf");
assert.equal(detectInputMask(field("document","00.000.000/0000-00")),"cnpj");
assert.equal(detectInputMask(field("amount","","currency")),"currency");

assert.equal(formatCpf("52998224725"),"529.982.247-25");
assert.equal(formatCnpj("11222333000181"),"11.222.333/0001-81");
assert.equal(formatPhone("11987654321"),"(11) 98765-4321");
assert.equal(formatCep("12345678"),"12345-678");
assert.equal(parseBRL("R$ 1.234,56"),1234.56);
assert.equal(parseBRL("79,90"),79.9);

console.log("Testes de máscaras e conversão BRL concluídos.");
