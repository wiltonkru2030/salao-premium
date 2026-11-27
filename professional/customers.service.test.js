/** Testa escopo, paginação e falha fechada com cliente Supabase simulado. */
import assert from "node:assert/strict";
import {fetchProfessionalCustomers,fetchProfessionalCustomerHistory} from "./customers.service.js";
const org="11111111-1111-1111-1111-111111111111",pid="22222222-2222-2222-2222-222222222222",branch="33333333-3333-3333-3333-333333333333",id="44444444-4444-4444-4444-444444444444";
const professional={id:pid,org_id:org,branch_id:branch};
const calls=[];
function client(dataByTable){
 return {from(table){
  calls.push([table]);
  const q={then(resolve){return Promise.resolve(resolve({data:dataByTable[table]||[],error:null}));}};
  for(const method of ["select","eq","or","in","order","range","limit"])q[method]=(...args)=>{calls.push([table,method,...args]);return q;};
  return q;
 }};
}
const options={client:client({branches:[{id:branch}],customers:[{id,name:"Cliente"}],appointments:[{id}]}),organizationId:org,professional};
assert.equal((await fetchProfessionalCustomers(options)).length,1);
assert.ok(calls.some(row=>row[0]==="customers"&&row[1]==="eq"&&row[2]==="org_id"&&row[3]===org));
assert.ok(calls.some(row=>row[0]==="customers"&&row[1]==="or"&&row[2].includes(branch)));
assert.equal((await fetchProfessionalCustomerHistory({...options,customerId:id})).length,1);
assert.ok(calls.some(row=>row[0]==="appointments"&&row[1]==="eq"&&row[2]==="professional_id"&&row[3]===pid));
assert.ok(calls.some(row=>row[0]==="appointments"&&row[1]==="in"&&row[2]==="branch_id"&&row[3][0]===branch));
assert.deepEqual(await fetchProfessionalCustomers({...options,client:client({})}),[]);
await assert.rejects(()=>fetchProfessionalCustomers({...options,professional:{...professional,org_id:id}}),/identificar/);
console.log("Carteira profissional: OK");
