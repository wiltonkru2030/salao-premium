/**
 * Testes do serviço de categorias do catálogo.
 * Responsabilidade: validar paginação, isolamento por organização e RPCs de gravação.
 */
import assert from "node:assert/strict";
import {listCatalogCategories,saveCatalogCategory,setCatalogCategoryActive} from "./categories.service.js";

function mockClient(tables={},rpcResult={data:"category-a",error:null},queryError=null){
  const calls=[];
  const client={
    calls,
    from(table){
      const call={table,filters:[],range:null};calls.push(call);
      const query={
        select(columns){call.columns=columns;return query;},
        eq(key,value){call.filters.push([key,value]);return query;},
        order(key){call.order=key;return query;},
        range(start,end){call.range=[start,end];return query;},
        then(resolve,reject){
          if(queryError)return Promise.resolve({data:null,error:queryError}).then(resolve,reject);
          let rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
          const [start,end]=call.range||[0,249];
          return Promise.resolve({data:rows.slice(start,end+1),error:null}).then(resolve,reject);
        }
      };
      return query;
    },
    rpc:async(name,args)=>{calls.push({rpc:name,args});return name==="set_catalog_category_active"?{data:true,error:null}:rpcResult;}
  };
  return client;
}
async function run(){
  const rows=Array.from({length:251},(_,i)=>({
    id:"c"+i,org_id:"org-a",category_type:"service",name:"Categoria "+i,active:true
  }));
  const client=mockClient({catalog_categories:rows});
  assert.equal((await listCatalogCategories({client,orgId:"org-a",categoryType:"service",activeOnly:true})).length,251);
  assert.deepEqual(client.calls.slice(0,2).map(call=>call.range),[[0,249],[250,499]]);
  assert.ok(client.calls.every(call=>call.filters.some(([key,value])=>key==="org_id"&&value==="org-a")));
  assert.equal(await saveCatalogCategory({
    client,orgId:"org-a",categoryType:"service",name:"Cabelo"
  }),"category-a");
  assert.equal(client.calls[2].rpc,"save_catalog_category");
  assert.equal(client.calls[2].args.p_name,"Cabelo");
  assert.equal(await setCatalogCategoryActive({
    client,orgId:"org-a",categoryId:"category-a",active:false
  }),true);
  assert.equal(client.calls[3].rpc,"set_catalog_category_active");
  await assert.rejects(()=>saveCatalogCategory({
    client,orgId:"org-a",categoryType:"invalid",name:"X"
  }),{name:"TypeError"});
  const failing=mockClient({},null,{code:"42501",message:"SQL privado"});
  await assert.rejects(()=>listCatalogCategories({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  console.log("Testes do serviço de categorias: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
