/**
 * Testes do serviço administrativo de cupons.
 * Responsabilidade: validar payloads, paginação, escopo do tenant e RPCs de gravação.
 */
import assert from "node:assert/strict";
import {
  listCoupons,buildCouponPayload,saveCoupon,deactivateCoupon,formatCouponDiscount
} from "./coupon.service.js";

function form(values={}) {
  const data=new FormData();
  for(const [key,value] of Object.entries(values)) {
    if(Array.isArray(value))value.forEach(item=>data.append(key,item));
    else if(value!==null&&value!==undefined)data.append(key,String(value));
  }
  return data;
}

function queryClient(tables) {
  const calls=[];
  const client={
    calls,
    from(table) {
      let filters=[],range=[0,249],order=null;
      const query={
        select(columns){calls.push({table,columns});return query;},
        eq(key,value){filters.push([key,value]);return query;},
        order(key,options){order=[key,options];return query;},
        range(start,end){range=[start,end];return query;},
        then(resolve,reject){
          let rows=(tables[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));
          if(order)rows=[...rows].sort((a,b)=>String(a[order[0]]).localeCompare(String(b[order[0]]))*(order[1]?.ascending===false?-1:1));
          return Promise.resolve({data:rows.slice(range[0],range[1]+1),error:null}).then(resolve,reject);
        }
      };
      return query;
    }
  };
  return client;
}

async function run(){
  const payload=buildCouponPayload(form({
    code:"black20",title:"Black Friday",description:"Desconto especial",
    discount_type:"percent",discount_value:"20,00",max_discount_amount:"",
    minimum_amount:"0,00",branch_id:"",coupon_id:"",
    starts_at:"2026-11-20T10:00",ends_at:"2026-12-20T23:59",
    usage_limit:"100",usage_per_customer:"1",active:"on",service_ids:["service-a","service-a"]
  }),"org-a");
  assert.equal(payload.p_code,"BLACK20");
  assert.equal(payload.p_discount_value,20);
  assert.equal(payload.p_active,true);
  assert.deepEqual(payload.p_service_ids,["service-a"]);
  assert.equal(payload.p_usage_limit,100);
  assert.throws(()=>buildCouponPayload(form({
    code:"X",title:"x",discount_type:"percent",discount_value:"150",
    minimum_amount:"0",starts_at:"2026-11-20T10:00",ends_at:"2026-11-21T10:00",usage_per_customer:"1"
  }),"org-a"),{name:"TypeError"});

  const data=queryClient({
    salon_coupons:[{id:"coupon-a",org_id:"org-a",code:"BLACK20",created_at:"2026-11-20"}],
    services:[{id:"service-a",org_id:"org-a",name:"Corte",active:true}],
    branches:[{id:"branch-a",org_id:"org-a",name:"Centro",active:true}],
    salon_coupon_services:[{org_id:"org-a",coupon_id:"coupon-a",service_id:"service-a"}],
    customer_coupon_redemptions:[{org_id:"org-a",coupon_id:"coupon-a",status:"redeemed"}]
  });
  const listed=await listCoupons({client:data,orgId:"org-a"});
  assert.equal(listed.coupons[0].serviceIds[0],"service-a");
  assert.equal(listed.redemptions.length,1);
  assert.ok(data.calls.every(call=>call.table!=="organizations"));

  const rpcCalls=[];
  const rpcClient={rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:"coupon-id",error:null};}};
  assert.equal(await saveCoupon({client:rpcClient,payload}),"coupon-id");
  assert.equal(rpcCalls[0].name,"save_salon_coupon");
  assert.equal(await deactivateCoupon({client:{rpc:async()=>({data:true,error:null})},orgId:"org-a",couponId:"coupon-a"}),true);
  assert.equal(formatCouponDiscount({discount_type:"percent",discount_value:15}),"15% de desconto");
  console.log("Testes do serviço administrativo de cupons: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
