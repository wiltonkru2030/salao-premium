/**
 * Testes do serviço de despesas.
 * Responsabilidade: validar tenant, cadastro, RPCs transacionais e erros seguros.
 */
import assert from "node:assert/strict";
import {listExpenses,createExpense,payExpense,cancelExpense} from "./expenses.service.js";

function mockClient(tables={},error=null) {
  const calls=[];
  return {calls,from(table) {
    const call={table,filters:[],payload:null,limit:null};calls.push(call);
    const query={
      select(columns){call.columns=columns;return query;},
      insert(payload){call.action="insert";call.payload=payload;return query;},
      eq(key,value){call.filters.push([key,value]);return query;},
      order(key,options){call.order=[key,options];return query;},
      limit(value){call.limit=value;return query;},
      then(resolve,reject){
        if(error)return Promise.resolve({data:null,error}).then(resolve,reject);
        const rows=(tables[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        return Promise.resolve({data:rows.slice(0,call.limit||500),error:null}).then(resolve,reject);
      }
    };
    return query;
  },rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:{success:true},error};}};
}
async function run(){
  const client=mockClient({expenses:[{id:"expense-a",org_id:"org-a",description:"Aluguel",status:"pending"}]});
  assert.equal((await listExpenses({client,orgId:"org-a"})).length,1);
  assert.ok(client.calls[0].filters.some(([key,value])=>key==="org_id"&&value==="org-a"));
  const branchClient=mockClient({expenses:[]});
  await listExpenses({client:branchClient,orgId:"org-a",branchId:"branch-a"});
  assert.ok(branchClient.calls[0].filters.some(([key,value])=>key==="branch_id"&&value==="branch-a"));
  await createExpense({client,orgId:"org-a",branchId:"branch-a",createdBy:"user-a",description:" Aluguel ",amount:1200,dueDate:"2026-12-10"});
  const inserted=client.calls[1].payload;
  assert.equal(inserted.org_id,"org-a");
  assert.equal(inserted.branch_id,"branch-a");
  assert.equal(inserted.status,"pending");
  assert.equal(inserted.description,"Aluguel");
  await payExpense({client,orgId:"org-a",expenseId:"expense-a",paymentMethod:"pix",useCash:true});
  const payment=client.calls.find(call=>call.rpc==="pay_expense");
  assert.equal(payment.args.p_payment_method,"pix");
  assert.equal(payment.args.p_use_cash,true);
  await cancelExpense({client,orgId:"org-a",expenseId:"expense-a"});
  assert.ok(client.calls.some(call=>call.rpc==="cancel_expense"));
  await assert.rejects(()=>createExpense({client,orgId:"org-a",description:"X",amount:0}),{name:"TypeError"});
  await assert.rejects(()=>createExpense({client,orgId:"org-a",description:"Aluguel",amount:20,dueDate:"2026-02-30"}),{name:"TypeError"});
  await assert.rejects(()=>payExpense({client,orgId:"org-a",expenseId:"x",paymentMethod:"invalid"}),{name:"TypeError"});
  const failing=mockClient({}, {code:"42501",message:"SQL privado"});
  await assert.rejects(()=>listExpenses({client:failing,orgId:"org-a"}),e=>!e.message.includes("SQL privado"));
  const network=mockClient();
  network.rpc=async()=>{throw new Error("network SQL secret");};
  await assert.rejects(()=>payExpense({client:network,orgId:"org-a",expenseId:"x",paymentMethod:"cash"}),e=>!e.message.includes("network SQL secret"));
  console.log("Testes do serviço de despesas: OK");
}
run().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
