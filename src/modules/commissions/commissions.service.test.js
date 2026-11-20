/**
 * Testes do serviço de dados do painel de comissões.
 * Responsabilidade: validar isolamento por organização, paginação e vínculos de Comanda.
 * Ecossistema: Painel Web do SALÃO PREMIUM.
 */
import assert from "node:assert/strict";
import {
  COMMISSION_PAGE_SIZE,fetchCommissionPageData,fetchCommissionReferences
} from "./commissions.service.js";

/** Cria cliente Supabase simulado com filtros, lotes e intervalos registrados. */
function mockClient(tables,failTable=null) {
  const calls=[];
  const client={
    calls,
    from(table) {
      const call={table,filters:[],selection:"",orders:[],range:null};
      calls.push(call);
      const query={
        select(value){call.selection=value;return this;},
        eq(key,value){call.filters.push({key,operator:"eq",value});return this;},
        is(key,value){call.filters.push({key,operator:"is",value});return this;},
        in(key,value){call.filters.push({key,operator:"in",value});return this;},
        order(key,options){call.orders.push({key,options});return this;},
        range(start,end){call.range=[start,end];return this;},
        then(resolve,reject) {
          if(table===failTable)return Promise.resolve({data:null,error:{message:"SQL privado"}}).then(resolve,reject);
          let rows=[...(tables[table]||[])];
          for(const filter of call.filters) {
            rows=rows.filter(row=>{
              if(filter.operator==="eq")return row[filter.key]===filter.value;
              if(filter.operator==="is")return row[filter.key]===filter.value;
              return filter.value.includes(row[filter.key]);
            });
          }
          for(const order of call.orders) {
            rows.sort((a,b)=>String(a[order.key]??"").localeCompare(String(b[order.key]??""))*(order.options?.ascending===false?-1:1));
          }
          const [start,end]=call.range||[0,COMMISSION_PAGE_SIZE-1];
          return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);
        }
      };
      return query;
    }
  };
  return {client,calls};
}

async function run() {
  const commissions=Array.from({length:COMMISSION_PAGE_SIZE+1},(_,index)=>({
    id:"commission-"+index,org_id:"org-a",professional_id:"professional-a",
    service_order_item_id:index===0?"item-a":null,service_order_payment_id:index===0?"payment-a":null
  }));
  const mock=mockClient({
    commissions,
    professionals:[{id:"professional-a",org_id:"org-a",name:"Ana",active:true}],
    commission_payouts:[{id:"payout-a",org_id:"org-a",professional_id:"professional-a",amount:25}],
    app_settings:[{id:"setting-a",org_id:"org-a",branch_id:null,setting_key:"product_commission",setting_value:{enabled:true,default_rate:10}}],
    services:[{id:"service-a",org_id:"org-a",name:"Corte",active:true}],
    commission_rules:[{id:"rule-a",org_id:"org-a",professional_id:"professional-a",service_id:"service-a",active:true,rate:50,item_type:"service"}]
  });
  const data=await fetchCommissionPageData({client:mock.client,organizationId:"org-a"});
  assert.equal(data.commissions.length,COMMISSION_PAGE_SIZE+1);
  assert.equal(data.productSetting.id,"setting-a");
  assert.equal(data.serviceRules.length,1);
  for(const call of mock.calls) {
    if(["commissions","professionals","commission_payouts","app_settings","services","commission_rules"].includes(call.table)) {
      assert.ok(call.filters.some(filter=>filter.key==="org_id"&&filter.value==="org-a"));
    }
  }
  const commissionCalls=mock.calls.filter(call=>call.table==="commissions");
  assert.deepEqual(commissionCalls.map(call=>call.range),[[0,249],[250,499]]);

  const references=await fetchCommissionReferences({
    client:mock.client,organizationId:"org-a",commissions:[commissions[0]],isProfessional:false
  });
  assert.equal(references.commissionItems[0].id,"item-a");
  assert.equal(references.commissionPayments[0].id,"payment-a");
  assert.equal(references.commissionOrders[0].order_number,123);

  const professionalMock=mockClient({
    commissions:[],professionals:[],commission_payouts:[],services:[],commission_rules:[],
    service_order_items:[],service_orders:[]
  });
  const professionalData=await fetchCommissionPageData({
    client:professionalMock.client,organizationId:"org-a",isProfessional:true
  });
  assert.equal(professionalData.productSetting,null);
  assert.equal(professionalData.serviceRules.length,0);
  assert.ok(!professionalMock.calls.some(call=>call.table==="app_settings"||call.table==="commission_rules"));

  await assert.rejects(()=>fetchCommissionPageData({
    client:mock.client,organizationId:"",isProfessional:false
  }),{name:"TypeError"});

  const failed=mockClient({}, "commissions");
  await assert.rejects(()=>fetchCommissionPageData({
    client:failed.client,organizationId:"org-a"
  }),error=>error.message.includes("Não foi possível carregar os lançamentos")
    && !error.message.includes("SQL privado"));

  console.log("Testes do serviço de comissões do painel: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
