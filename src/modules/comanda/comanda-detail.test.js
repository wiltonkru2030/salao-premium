/**
 * Testes do componente de detalhes da Comanda.
 * Garante apresentação segura sem acesso ao banco e respeita permissões recebidas.
 */
import assert from "node:assert/strict";
import { buildComandaDetails } from "./components/comanda-detail.js";

const view = buildComandaDetails(
  { id:"order-1",order_number:12,status:"open",total:100,subtotal:100,discount:0,created_at:"2026-11-13T10:00:00Z",notes:"",customer_id:null },
  { items:[],payments:[],customer:{name:"Cliente <teste>",phone:""},professional:null,services:[],products:[],professionals:[] },
  { canManage:false,canPay:false,canEditItems:false,canRefund:false }
);
assert.match(view.html,/Cliente &lt;teste&gt;/);
assert.match(view.html,/Comanda #12/);
assert.equal(view.paid,0);
assert.equal(view.balance,100);
assert.equal(view.allowEdit,false);
assert.equal(view.allowPay,false);
assert.equal(view.canEditItems,false);

process.stdout.write("Testes do componente Comanda: OK\n");
