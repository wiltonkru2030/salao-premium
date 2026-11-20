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


const professionalView = buildComandaDetails(
  { id:"order-pro",order_number:13,status:"in_progress",total:120,subtotal:120,discount:0,created_at:"2026-11-19T10:00:00Z",notes:"",customer_id:null },
  { items:[],payments:[],customer:{name:"Cliente",phone:""},professional:{name:"Profissional"},services:[],products:[],professionals:[{id:"pro-1",name:"Profissional"}] },
  { canManage:false,canPay:false,canEditItems:false,canRefund:false,canAddOwnService:true,isProfessional:true }
);
assert.match(professionalView.html,/Adicionar serviço/);
assert.match(professionalView.html,/vinculado automaticamente ao seu perfil profissional/);
assert.doesNotMatch(professionalView.html,/Adicionar produto/);
assert.doesNotMatch(professionalView.html,/Registrar pagamento/);
assert.match(professionalView.html,/histórico de pagamentos e o saldo são restritos/);
assert.doesNotMatch(professionalView.html,/Nenhum pagamento registrado/);

const unauthorizedProfessionalView = buildComandaDetails(
  { id:"order-pro-2",order_number:14,status:"in_progress",total:80,subtotal:80,discount:0,created_at:"2026-11-19T10:00:00Z",notes:"",customer_id:null },
  { items:[],payments:[],customer:null,professional:null,services:[],products:[],professionals:[] },
  { canManage:false,canPay:false,canEditItems:false,canRefund:false,canAddOwnService:false,isProfessional:true }
);
assert.doesNotMatch(unauthorizedProfessionalView.html,/Adicionar serviço/);
assert.doesNotMatch(unauthorizedProfessionalView.html,/Adicionar produto/);

process.stdout.write("Testes do componente Comanda: OK\n");
