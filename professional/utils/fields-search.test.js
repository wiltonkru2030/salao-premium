/** Regressões de pesquisa por palavras, telefone, valores e configuração Pix. */
import assert from "node:assert/strict";
import {matchesSearch,matchesPhone,searchCatalog} from "./search.js";
import {pixFieldConfig,displayPixKey,updatePixField} from "./pix-fields.js";
import {normalizeProfilePreferences} from "../profile-preferences.service.js";
assert.equal(matchesSearch("Hidratação Capilar","capilar hidratacao"),true);
assert.equal(matchesPhone("+55 (67) 99999-1234","99999-1234"),true);
assert.equal(matchesPhone("67999991234","ana 123"),false);
assert.deepEqual(searchCatalog([{id:"1",name:"Corte",category:"Cabelo",price:80,duration_minutes:45},{id:"2",name:"Unhas",price:30}],"cabelo 80").map(r=>r.id),["1"]);
assert.equal(displayPixKey("phone","5567999991234"),"(67) 99999-1234");
assert.equal(displayPixKey("cpf","52998224725"),"529.982.247-25");
assert.equal(displayPixKey("cnpj","11222333000181"),"11.222.333/0001-81");
assert.equal(pixFieldConfig("email").mask,"none");
const input={value:"old",dataset:{}},type={value:"cpf"},form={querySelector:selector=>selector.includes("pixType")?type:input};
updatePixField(form);assert.equal(input.value,"");assert.equal(input.dataset.mask,"cpf");assert.equal(input.required,true);
type.value="";updatePixField(form);assert.equal(input.disabled,true);
assert.throws(()=>normalizeProfilePreferences({pixType:"cpf",pixKey:"abc52998224725"}),/formato/);
assert.throws(()=>normalizeProfilePreferences({pixType:"phone",pixKey:"+1 415 555 2671"}),/brasileiro/);
console.log("Pesquisa e campos Pix: OK");
