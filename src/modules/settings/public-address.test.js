/** Testes da consulta de endereço público, sem rede externa. */
import assert from "node:assert/strict";
import {lookupPublicAddress} from "./public-address.controller.js";

const address = await lookupPublicAddress("01001-000", {request: async (url, options) => {
  assert.equal(url, "https://viacep.com.br/ws/01001000/json/");
  assert.equal(options.referrerPolicy, "no-referrer");
  return {ok: true, json: async () => ({
    logradouro: " Praça da Sé ", bairro: "Sé", localidade: "São Paulo", uf: "SP"
  })};
}});
assert.deepEqual(address, {public_address:"Praça da Sé",neighborhood:"Sé",city:"São Paulo",state:"SP"});
assert.equal(await lookupPublicAddress("01001000", {
  request: async () => ({ok:true,json:async () => ({erro:true})})
}), null);
await assert.rejects(() => lookupPublicAddress("00001", {
  request: async () => assert.fail("CEP inválido não deve chamar rede")
}), TypeError);
await assert.rejects(() => lookupPublicAddress("01001000", {
  request: async () => ({ok:false})
}), /indisponível/);
await assert.rejects(() => lookupPublicAddress("01001000", {
  request: async () => ({ok:true,json:async () => ({localidade:"São Paulo",uf:"SPP"})})
}), /inválida/);
console.log("Consulta de CEP: formato, endereço, não encontrado e falhas verificados.");
