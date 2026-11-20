/**
 * Verifica filtragem, escape de dados e permissões da interface de categorias.
 */
import assert from "node:assert/strict";
import {renderCategoriesView} from "./categories.view.js";
const rows=[{id:"s1",name:"<script>teste</script>",category_type:"service",active:true},{id:"p1",name:"Cosméticos",category_type:"product",active:false}];
const html=renderCategoriesView(rows,"service",true);
assert.ok(html.includes('data-edit-category="s1"'));
assert.ok(!html.includes('data-edit-category="p1"'));
assert.ok(!html.includes("<script>"));
assert.ok(renderCategoriesView(rows,"product",true).includes('data-edit-category="p1"'));
assert.ok(!renderCategoriesView(rows,"product",false).includes('data-edit-category="p1"'));
assert.ok(renderCategoriesView([],"service").includes("Nenhuma categoria cadastrada."));
assert.throws(()=>renderCategoriesView(null,"service"),TypeError);
console.log("Testes da interface de categorias: OK.");
