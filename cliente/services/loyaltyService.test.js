/** Testes do histórico real por identidade global, sem usuários ou pedidos fictícios no banco. */
import assert from "node:assert/strict";
import {getMyLoyaltyOverview} from "./loyaltyService.js";
const userId="11111111-1111-4111-8111-111111111111";
let calls=0;
const client={
 auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
 rpc:async name=>{
  assert.equal(name,"get_my_customer_loyalty_overview");calls++;
  return {data:[{org_id:"22222222-2222-4222-8222-222222222222",salon_name:"Studio",
   completed_appointments:4,paid_orders:2,total_paid:"250.50",last_paid_at:"2026-11-20T14:00:00Z"}],error:null};
 }
};
const result=await getMyLoyaltyOverview({client,expectedUserId:userId});
assert.equal(result.length,1);
assert.deepEqual(result[0],{
 orgId:"22222222-2222-4222-8222-222222222222",salonName:"Studio",
 completedAppointments:4,paidOrders:2,totalPaid:250.5,lastPaidAt:"2026-11-20T14:00:00Z"
});
assert.equal(calls,1);
await assert.rejects(()=>getMyLoyaltyOverview({client,expectedUserId:"outro"}),/sessão mudou/);
assert.equal(calls,1);
const invalid={...client,rpc:async()=>({data:[{org_id:"ok",completed_appointments:-1,paid_orders:0,total_paid:0}],error:null})};
await assert.rejects(()=>getMyLoyaltyOverview({client:invalid,expectedUserId:userId}),/conferência/);
const errorClient={...client,rpc:async()=>({data:null,error:{code:"42501",message:"internal"}})};
await assert.rejects(()=>getMyLoyaltyOverview({client:errorClient,expectedUserId:userId}),/permissão/);
console.log("Consulta de fidelidade por identidade: OK");
