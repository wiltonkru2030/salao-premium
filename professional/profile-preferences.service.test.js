/** Valida formatos e impede alteração de campos administrativos no payload. */
import assert from "node:assert/strict";
import {normalizeProfilePreferences,saveProfilePreferences} from "./profile-preferences.service.js";
const input={email:"a@example.com",pixType:"phone",pixKey:"(67) 99999-1234",photoUrl:"https://example.com/photo.png",notifyAgenda:true,notifyCommissions:false};
const result=normalizeProfilePreferences(input);
assert.equal(result.new_pix_key,"5567999991234");
assert.equal(result.agenda_enabled,true);
assert.equal(result.commissions_enabled,false);
assert.throws(()=>normalizeProfilePreferences({...input,photoUrl:"javascript:alert(1)"}),/HTTPS/);
assert.throws(()=>normalizeProfilePreferences({...input,pixKey:"123"}),/Pix/);
assert.throws(()=>normalizeProfilePreferences({...input,email:"invalid"}),/e-mail/);
let call;
await saveProfilePreferences({client:{rpc:async(name,payload)=>{call={name,payload};return {data:{name:"Teste"}};}},organizationId:"org",...input,name:"Não alterar"});
assert.equal(call.name,"save_professional_app_preferences");assert.equal(call.payload.target_org,"org");assert.equal("name" in call.payload,false);
console.log("Preferências profissionais: OK");
