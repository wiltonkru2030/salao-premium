/**
 * Testes do serviço de catálogo e estoque de produtos.
 * Responsabilidade: validar paginação, valores, escopo por organização e inativação.
 */
import assert from "node:assert/strict";
import {listProducts,saveProduct,setProductActive} from "./products.service.js";

function mockClient(tables={},error=null){
  const calls=[];
  const client={calls,from(table){
    const call={table,filters:[],action:null,payload:null,range:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      insert(payload){call.action="insert";call.payload=payload;return query;},
      update(payload){call.action="update";call.payload=payload;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      or(expression){call.or=expression;return query;},
      order(key){call.order=key;return query;},
      range(start,end){call.range=[start,end];return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        let rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        const [start,end]=call.range||[0,249];
        return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
  return client;
}
async function run(){
  const rows=Array.from({length:251},(_,i)=>({id:"p"+i,org_id:"org-a",name:"Produto "+i}));
  const client=mockClient({products:rows});
  assert.equal((await listProducts({client,orgId:"org-a"})).length,251);
  const branchClient=mockClient({products:[]});
  await listProducts({client:branchClient,orgId:"org-a",branchId:"11111111-1111-4111-8111-111111111111"});
  assert.equal(branchClient.calls[0].or,"branch_id.eq.11111111-1111-4111-8111-111111111111,branch_id.is.null");
  await saveProduct({client,orgId:"org-a",name:"Shampoo",sku:"SH-01",category:"Cabelo",costPrice:10,salePrice:25,stockQuantity:12,minStock:2});
  assert.equal(client.calls[2].payload.org_id,"org-a");
  assert.equal(client.calls[2].payload.stock_quantity,12);
  await saveProduct({client,orgId:"org-a",productId:"p1",name:"Shampoo novo",costPrice:12,salePrice:30,stockQuantity:8,minStock:1});
  assert.deepEqual(client.calls[3].filters,[["org_id","org-a"],["id","p1"]]);
  assert.ok(!("stock_quantity" in client.calls[3].payload),"Edição não pode alterar saldo fora de movimentação de estoque.");
  await setProductActive({client,orgId:"org-a",productId:"p1",active:false});
  assert.deepEqual(client.calls[4].payload,{active:false});
  const branchId="11111111-1111-4111-8111-111111111111";
  const scoped=mockClient({products:[]});
  await saveProduct({client:scoped,orgId:"org-a",branchId,name:"Condicionador",costPrice:10,salePrice:20});
  assert.equal(scoped.calls[0].payload.branch_id,branchId,"novo produto deve pertencer à filial ativa");
  await saveProduct({client:scoped,orgId:"org-a",branchId,productId:"p1",name:"Condicionador",costPrice:10,salePrice:20});
  assert.equal(scoped.calls[1].or,"branch_id.eq."+branchId+",branch_id.is.null");
  await setProductActive({client:scoped,orgId:"org-a",branchId,productId:"p1",active:false});
  assert.equal(scoped.calls[2].or,"branch_id.eq."+branchId+",branch_id.is.null");
  await assert.rejects(()=>saveProduct({client,orgId:"org-a",name:"Shampoo",costPrice:-1,salePrice:25}),{name:"TypeError"});
  await assert.rejects(()=>saveProduct({client,orgId:"org-a",name:"Shampoo",costPrice:1,salePrice:25,sku:"x".repeat(65)}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>listProducts({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.from=()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>setProductActive({client:network,orgId:"org-a",productId:"p1",active:false}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do catálogo de produtos: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
