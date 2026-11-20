/**
 * Testes da interface de serviços: segurança, permissões e campos do modal.
 */
import assert from "node:assert/strict";
import { renderServicesView } from "./services.view.js";
const service={id:"s1",name:"<script>teste</script>",active:true,duration_minutes:30,price:50};
const html=renderServicesView([service],[{name:"Categoria <teste>"}],true);
assert.ok(html.includes('id="service-create-form"'));
assert.ok(html.includes('data-edit-service="s1"'));
assert.ok(html.includes('data-mask="currency"'));
assert.ok(html.includes('name="duration"'));
assert.ok(!html.includes("<script>"));
assert.ok(!html.includes("Categoria <teste>"));
assert.ok(!renderServicesView([service],null,false).includes('data-edit-service="s1"'));
assert.ok(renderServicesView([],[],true).includes("Nenhum serviço cadastrado."));
assert.throws(()=>renderServicesView(null,[]),TypeError);
console.log("Testes da interface de serviços: OK.");

/** Serviços exclusivos devem identificar sua unidade e oferecer apenas filiais ativas. */
const scoped=renderServicesView([{...service,branch_id:"b1"}],[],true,[{id:"b1",name:"Unidade Centro",active:true},{id:"b2",name:"Unidade Fechada",active:false}]);
assert.ok(scoped.includes('name="branch_id"'));
assert.ok(scoped.includes('value="b1">Unidade Centro'));
assert.ok(scoped.includes("min · Unidade Centro"));
assert.ok(!scoped.includes('value="b2"'));
assert.ok(html.includes("Todas as unidades"));
