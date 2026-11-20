/**
 * Testes da interface de produtos: permissões, máscaras e escape de dados.
 */
import assert from "node:assert/strict";
import { renderProductsView } from "./products.view.js";
const product={id:"p1",name:"<script>teste</script>",active:true,stock_quantity:5,min_stock:2,sale_price:25};
const html=renderProductsView([product],[{name:"Categoria <teste>"}],true);
assert.ok(html.includes('id="product-create-form"'));
assert.ok(html.includes('data-edit-product="p1"'));
assert.ok(html.includes('data-mask="currency"'));
assert.ok(html.includes('name="stock_quantity"'));
assert.ok(!html.includes("<script>"));
assert.ok(!html.includes("Categoria <teste>"));
assert.ok(!renderProductsView([product],null,false).includes('data-edit-product="p1"'));
assert.ok(renderProductsView([],[],true).includes("Nenhum produto cadastrado."));
assert.throws(()=>renderProductsView(null,[]),TypeError);
console.log("Testes da interface de produtos: OK.");
