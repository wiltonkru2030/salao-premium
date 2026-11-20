/**
 * Testes da tela de favoritos da cliente.
 */
import assert from "node:assert/strict";
import { renderFavoritesView } from "./favoritesView.js";
assert.ok(renderFavoritesView({loading:true}).includes("Carregando favoritos"));
assert.ok(renderFavoritesView({error:"Falha <script>"}).includes("Falha &lt;script&gt;"));
assert.ok(renderFavoritesView({items:[]}).includes("Nenhum favorito salvo"));
const html=renderFavoritesView({items:[{org_id:"org",slug:"studio",branch_id:"branch",display_name:"Studio",branch_name:"Centro",city:"Três Lagoas",state:"MS"}]});
assert.ok(html.includes('data-action="open-favorite"'));
assert.ok(html.includes('data-action="remove-favorite"'));
console.log("Testes da tela de favoritos: OK");
