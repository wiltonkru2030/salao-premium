/** Testes de moeda, payload e erros, sem conexão com o banco. */
import assert from "node:assert/strict";
import {parseServicePrice,saveUnitService,setUnitServiceLink} from "./services.service.js";
assert.equal(parseServicePrice("R$ 1.234,56"),1234.56);
assert.equal(parseServicePrice("0,00"),0);
assert.throws(()=>parseServicePrice("-10,00"),/valor/i);
assert.throws(()=>parseServicePrice("abc"),/valor/i);
let call;
const client={rpc:async(name,args)=>{call={name,args};return {data:"saved"};}};
await saveUnitService({client,organizationId:"org",name:" Corte ",category:"Cabelo",minutes:30,price:"50,00"});
assert.equal(call.args.service_name,"Corte");assert.equal(call.args.service_price,50);assert.equal(call.args.target_service,null);
await assert.rejects(()=>setUnitServiceLink({client:{rpc:async()=>({error:{code:"23514"}})},organizationId:"org",serviceId:"s",linked:false}),/agendamentos/);
console.log("Serviços profissionais: OK");
