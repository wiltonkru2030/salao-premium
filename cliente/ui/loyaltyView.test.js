/** Testes de renderização dos indicadores, mensagens e escape. */
import assert from "node:assert/strict";
import {renderLoyaltyView} from "./loyaltyView.js";
const html=renderLoyaltyView({items:[{orgId:"1",salonName:"<img src=x onerror=alert(1)>",
 completedAppointments:3,paidOrders:1,totalPaid:123.45,lastPaidAt:"2026-11-20T12:00:00Z"}]});
assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
assert.ok(!html.includes("<img src=x"));
assert.ok(html.includes("123,45"));
assert.ok(html.includes('data-action="reload-loyalty"'));
assert.ok(html.includes("Pontos, benefícios e descontos"));
assert.ok(renderLoyaltyView({loading:true}).includes("Consultando seus registros"));
assert.ok(renderLoyaltyView({items:[]}).includes("Ainda não há atendimentos"));
console.log("Indicadores de fidelidade: HTML seguro OK");
