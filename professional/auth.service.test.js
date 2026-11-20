/** Testa autenticação profissional sem conexão real ou credenciais de produção. */
import assert from "node:assert/strict";
import {authenticateProfessional} from "./auth.service.js";
const calls=[];
const client={auth:{getUser:async()=>({data:{user:{id:"test"}}}),setSession:async()=>({error:null}),signInWithPassword:async input=>{calls.push(input);return {error:null};}},functions:{invoke:async(name,{body})=>{calls.push({name,...body});return {data:{access_token:"fake",refresh_token:"fake"}};}}};
assert.equal((await authenticateProfessional({client,login:"123.456.789-00",password:"test"})).id,"test");
assert.equal(calls[0].cpf,"12345678900");
await authenticateProfessional({client,login:" TEST@example.com ",password:"test"});
assert.equal(calls[1].email,"test@example.com");
await assert.rejects(()=>authenticateProfessional({client,login:"",password:"test"}));
client.functions.invoke=async()=>({data:{error:"internal details"},error:null});
await assert.rejects(()=>authenticateProfessional({client,login:"12345678900",password:"test"}),/CPF ou senha inválidos/);
