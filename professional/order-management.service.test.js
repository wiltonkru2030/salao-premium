/** Testes de permissão, quantidade, desconto e contrato simulado. */
import assert from "node:assert/strict";
import {canManageOrder,orderItemEditPayload,professionalOrderAction} from "./order-management.service.js";
const order={id:"o",branch_id:"b",assigned_professional_id:"p",status:"in_progress"};
const state={role:"professional",scope:"self",professional:{id:"p",can_edit_own_orders:true},selectedOrder:order};
assert.equal(canManageOrder(state),true);
assert.equal(canManageOrder({...state,professional:{id:"p",can_edit_own_orders:false}}),false);
assert.equal(canManageOrder(state,{...order,status:"partially_paid"}),false);
assert.equal(canManageOrder(state,{...order,assigned_professional_id:"x"}),false);
assert.deepEqual(orderItemEditPayload({id:"i",unit_price:30},2,"R$ 5,00"),{id:"i",quantity:2,discount:5});
assert.throws(()=>orderItemEditPayload({id:"i",unit_price:30},1,"R$ 31,00"),/Desconto/);
assert.throws(()=>orderItemEditPayload({id:"i",unit_price:30,source_appointment_id:"a",quantity:1},2,"0,00"),/mantida/);
let call;
const options={client:{rpc:async(name,args)=>{call={name,args};return {data:{id:"o"}};}},organizationId:"org",order,operation:"product",payload:{product:"x"}};
await professionalOrderAction(options);assert.equal(call.args.unit,"b");assert.equal(call.args.payload.product,"x");
await assert.rejects(()=>professionalOrderAction({...options,client:{rpc:async()=>({error:{code:"23514"}})}}),/bloqueada/);
console.log("Gestão profissional de comandas: OK");
