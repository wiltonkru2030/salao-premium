/**
 * Testes do serviço de validação de cupons públicos.
 * Responsabilidade: validar parâmetros, contrato RPC e mapeamento seguro de erros.
 */
import assert from "node:assert/strict";
import { validatePublicCoupon } from "./couponService.js";
const orgId="11111111-1111-4111-8111-111111111111";
const branchId="22222222-2222-4222-8222-222222222222";
const serviceId="33333333-3333-4333-8333-333333333333";
function clientMock(response){const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push({name,args});return response;}}};}
async function run(){
  const mock=clientMock({data:[{
    coupon_id:"44444444-4444-4444-8444-444444444444",code:"BLACK20",title:"Desconto",
    discount_type:"percent",discount_value:20,original_amount:150,discount_amount:30,final_amount:120
  }],error:null});
  const result=await validatePublicCoupon({client:mock.client,orgId,branchId,serviceId,code:" black20 "});
  assert.equal(result.discountAmount,30);
  assert.equal(result.finalAmount,120);
  assert.deepEqual(mock.calls[0],{name:"validate_public_coupon",args:{
    p_org_id:orgId,p_branch_id:branchId,p_service_id:serviceId,p_coupon_code:"BLACK20"
  }});
  await assert.rejects(()=>validatePublicCoupon({client:mock.client,orgId,branchId,serviceId,code:"x"}),{name:"TypeError"});
  const missing=clientMock({data:null,error:{code:"PGRST202"}});
  await assert.rejects(()=>validatePublicCoupon({client:missing.client,orgId,branchId,serviceId,code:"BLACK20"}),error=>error.code==="COUPON_BACKEND_NOT_READY");
  console.log("Testes do serviço de cupons: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
