/**
 * Testes do serviço de gravação de regras e repasses de comissão.
 * Responsabilidade: validar payloads, escopo por organização e contratos RPC.
 */
import assert from "node:assert/strict";
import {
  createServiceCommissionRule,updateServiceCommissionRule,
  deleteServiceCommissionRule,saveProductCommissionSetting,
  payProfessionalCommissions
} from "./commission-rules.service.js";

/** Cliente Supabase falso para inspecionar gravações sem rede ou banco real. */
function mockClient({error=null,rpcData={amount:50,payout_id:"payout-a"}}={}) {
  const calls=[];
  const client={
    calls,
    from(table) {
      const call={table,action:null,payload:null,filters:[]};
      calls.push(call);
      const query={
        insert(payload){call.action="insert";call.payload=payload;return query;},
        update(payload){call.action="update";call.payload=payload;return query;},
        delete(){call.action="delete";return query;},
        eq(key,value){call.filters.push([key,value]);return query;},
        then(resolve,reject){return Promise.resolve({data:null,error}).then(resolve,reject);}
      };
      return query;
    },
    rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:rpcData,error};}
  };
  return client;
}

async function run() {
  const client=mockClient();
  await createServiceCommissionRule({
    client,orgId:"org-a",professionalId:"professional-a",serviceId:"service-a",rate:50
  });
  assert.equal(client.calls[0].table,"commission_rules");
  assert.equal(client.calls[0].payload.org_id,"org-a");
  assert.equal(client.calls[0].payload.rate,50);
  assert.equal(client.calls[0].payload.item_type,"service");

  await updateServiceCommissionRule({
    client,orgId:"org-a",ruleId:"rule-a",professionalId:"professional-a",serviceId:"service-b",rate:40
  });
  assert.deepEqual(client.calls[1].filters,[["org_id","org-a"],["id","rule-a"]]);

  await deleteServiceCommissionRule({client,orgId:"org-a",ruleId:"rule-a"});
  assert.equal(client.calls[2].action,"delete");

  await saveProductCommissionSetting({
    client,orgId:"org-a",settingId:null,userId:"user-a",enabled:true,rate:10
  });
  assert.equal(client.calls[3].payload.setting_key,"product_commission");
  assert.deepEqual(client.calls[3].payload.setting_value,{enabled:true,default_rate:10});

  await saveProductCommissionSetting({
    client,orgId:"org-a",settingId:"setting-a",enabled:false,rate:0
  });
  assert.deepEqual(client.calls[4].filters,[["org_id","org-a"],["id","setting-a"]]);

  const payout=await payProfessionalCommissions({
    client,orgId:"org-a",professionalId:"professional-a",
    commissionIds:["commission-a","commission-a"],paymentMethod:"pix"
  });
  assert.equal(payout.amount,50);
  assert.deepEqual(client.calls[5].args.p_commission_ids,["commission-a"]);
  assert.equal(client.calls[5].rpc,"pay_professional_commissions");

  await assert.rejects(()=>createServiceCommissionRule({
    client,orgId:"org-a",professionalId:"professional-a",serviceId:"service-a",rate:101
  }),{name:"TypeError"});
  await assert.rejects(()=>payProfessionalCommissions({
    client,orgId:"org-a",professionalId:"professional-a",commissionIds:[]
  }),{name:"TypeError"});
  await assert.rejects(()=>saveProductCommissionSetting({
    client,orgId:"org-a",enabled:true,rate:0
  }),{name:"TypeError"});
  await assert.rejects(()=>payProfessionalCommissions({
    client,orgId:"org-a",professionalId:"professional-a",commissionIds:["commission-a"],paymentMethod:"   "
  }),{name:"TypeError"});
  await assert.rejects(()=>payProfessionalCommissions({
    client,orgId:"org-a",professionalId:"professional-a",commissionIds:["commission-a"],notes:"x".repeat(501)
  }),{name:"TypeError"});
  await assert.rejects(()=>payProfessionalCommissions({
    client,orgId:"org-a",professionalId:"professional-a",commissionIds:Array.from({length:501},(_,i)=>"c"+i)
  }),{name:"TypeError"});
  assert.equal(client.calls.filter(call=>call.rpc==="pay_professional_commissions").length,1,"Repasses inválidos não devem chamar o RPC.");


  const failing=mockClient({error:{code:"42501",message:"SQL privado"}});
  await assert.rejects(()=>createServiceCommissionRule({
    client:failing,orgId:"org-a",professionalId:"professional-a",serviceId:"service-a",rate:20
  }),error=>error.message.includes("permissão")&&!error.message.includes("SQL privado"));

  console.log("Testes do serviço de regras e repasses de comissão: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
