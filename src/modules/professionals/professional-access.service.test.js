/**
 * Testes do contrato remoto de acesso, sem chamadas reais.
 */
import assert from "node:assert/strict";
import {requestProfessionalAccess} from "./professional-access.service.js";
let calls=0;
const client={functions:{invoke:async(name,args)=>{calls++;assert.equal(name,"manage-professional-access");assert.equal(args.body.cpf,"52998224725");return {data:{success:true},error:null};}}};
const input={client,orgId:"org",professionalId:"p",action:"create",cpf:"529.982.247-25"};
assert.equal((await requestProfessionalAccess(input)).data.success,true);
await assert.rejects(()=>requestProfessionalAccess({...input,cpf:"11111111111"}));
await assert.rejects(()=>requestProfessionalAccess({...input,action:"delete"}));
assert.equal(calls,1);
console.log("Testes do acesso profissional: OK.");
