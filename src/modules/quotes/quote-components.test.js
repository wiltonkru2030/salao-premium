/**
 * Testes de apresentação dos componentes de Orçamentos.
 * Garante escape de conteúdo e renderização dos estados sem acessar o banco.
 */
import assert from "node:assert/strict";
import { renderQuoteBuilder, renderQuoteList } from "./components/quote-components.js";

import {findQuoteCustomers,findQuoteNamedOptions} from "./services/quote-customer-search.js";

const builder = renderQuoteBuilder({
  items: [{name:"Corte <premium>",quantity:2,price:50,discount:5,professionalName:"Ana"}],
  selectedCustomer: {name:"Cliente <teste>",phone:"11999990000"},
  services: [{id:"s1",name:"Corte",price:50}],
  professionals: [{id:"p1",name:"Ana"}],
  discountRules: new Set(["s1"]),
  maxDiscount: 10,
  allowFixedDiscount: true,
  notes: "Preferência <teste>",
  validUntil: "2027-02-10",
  canManageSettings: false
});
assert.match(builder,/Cliente &lt;teste&gt;/);
assert.match(builder,/Corte &lt;premium&gt;/);
assert.match(builder,/id="quote-discount-settings-card" hidden/);
assert.match(builder,/R\$|50,00/);

assert.match(builder,/id="quote-show-quick"/);
assert.match(builder,/Preferência &lt;teste&gt;/);
assert.match(builder,/value="2027-02-10"/);

const contacts = [{id:"c1",name:"João Silva",phone:"(11) 98888-1234"}, {id:"c2",name:"Ana"}];
assert.deepEqual(findQuoteCustomers(contacts,"JOAO").map(row=>row.id),["c1"]);
assert.deepEqual(findQuoteCustomers(contacts,"8888-12").map(row=>row.id),["c1"]);
assert.deepEqual(findQuoteCustomers(contacts,"()"),[]);
assert.equal(findQuoteCustomers(Array.from({length:10},(_,id)=>({id,name:"João"})),"joao").length,8);

assert.match(builder,/<input[^>]+id="quote-service"/);
assert.match(builder,/<input[^>]+id="quote-professional"[^>]+disabled/);
assert.deepEqual(findQuoteNamedOptions([{id:"s1",name:"Hidratação"}],"HIDRATACAO").map(row=>row.id),["s1"]);
assert.deepEqual(findQuoteNamedOptions([{id:"s1",name:"Hidratação"}],"corte"),[]);

const list = renderQuoteList([{id:"q1",quote_number:7,customer_id:"c1",created_at:"2026-11-12T12:00:00Z",status:"pending",total:100}],new Map([["c1","Cliente"]]));
assert.match(list,/Orçamento #7/);
assert.match(list,/Em análise/);
assert.match(list,/Cliente/);

process.stdout.write("Testes de componentes de Orçamentos: OK\n");
