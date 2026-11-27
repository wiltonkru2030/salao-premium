/** Testa filtro de data civil, estornos, saldo global e repasses em datas distintas. */
import assert from "node:assert/strict";
import {commissionDateKey,filterCommissionStatement,paymentMethodLabel} from "./commissions.rules.js";
const rows=[
 {amount:50,status:"pending",item_type:"service",created_at:"2026-11-02T02:00:00Z"},
 {amount:-10,status:"approved",item_type:"service",created_at:"2026-11-02T12:00:00Z"},
 {amount:20,status:"paid",item_type:"product",created_at:"2026-11-02T12:00:00Z"},
 {amount:100,status:"cancelled",item_type:"service",created_at:"2026-11-02T12:00:00Z"}
];
const payouts=[{amount:20,paid_at:"2026-11-03T12:00:00Z"}];
const tz="America/Campo_Grande";
assert.equal(commissionDateKey(rows[0].created_at,tz),"2026-11-01");
const result=filterCommissionStatement(rows,payouts,{from:"2026-11-02",to:"2026-11-02",status:"reversal",type:"service"},tz);
assert.equal(result.global.open,40);assert.equal(result.period.open,-10);assert.equal(result.payouts.length,0);
assert.equal(result.commissions.length,1);assert.equal(result.global.received,20);
assert.equal(paymentMethodLabel("credit_card"),"Cartão de crédito");
console.log("Filtros e extrato profissional: OK");
