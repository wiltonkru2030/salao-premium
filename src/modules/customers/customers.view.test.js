/**
 * Testes da estrutura visual de clientes do painel SALÃO PREMIUM.
 * Verifica controles, permissões visuais, máscaras e escape de dados sem navegador.
 */
import assert from "node:assert/strict";
import { renderCustomersView, renderCustomersStatus } from "./customers.view.js";

const rows=[{id:'x" onclick="alert(1)',name:"<script>teste</script>",active:true}];
const editable=renderCustomersView(rows,true);
assert.ok(editable.includes('id="customer-create-form"'));
assert.ok(editable.includes('data-mask="phone"'));
assert.ok(editable.includes('data-edit-customer='));
assert.ok(editable.includes('Inativar'));
assert.ok(editable.includes('&lt;script&gt;'));
assert.ok(!editable.includes('<script>'));
assert.ok(!editable.includes(' onclick="alert(1)'));
assert.ok(!renderCustomersView(rows,false).includes('data-edit-customer='));
assert.ok(!renderCustomersView(rows,false).includes('data-toggle-customer='));
assert.ok(renderCustomersView([],true).includes('Nenhum cliente cadastrado.'));
assert.throws(()=>renderCustomersView(null),TypeError);
console.log("Testes da estrutura visual de clientes: OK.");

// Estados transitórios não devem conter registros e permitem recuperar falhas.
assert.ok(renderCustomersStatus().includes('role="status"'));
assert.ok(!renderCustomersStatus().includes("data-retry-customers"));
assert.ok(renderCustomersStatus(true).includes('role="alert"'));
assert.ok(renderCustomersStatus(true).includes("data-retry-customers"));
