/**
 * Testes da busca pública na tela inicial da cliente.
 * Responsabilidade: validar estados e escape dos resultados.
 */
import assert from "node:assert/strict";
import { renderHomeView } from "./homeView.js";

assert.ok(renderHomeView({ loading: true }).includes("Buscando salões publicados"));
assert.ok(renderHomeView({ error: "Falha <script>" }).includes("Falha &lt;script&gt;"));
assert.ok(renderHomeView({ salons: [] }).includes("Nenhum salão publicado"));
const html = renderHomeView({
  salons: [{
    display_name: "<img src=x>", branch_name: "Centro", city: "Três Lagoas", state: "MS",
    slug: "studio-centro", branch_id: "branch-1", org_id: "org-1", distance_km: 1.2
  }]
});
assert.ok(html.includes("&lt;img src=x&gt;"));
assert.ok(!html.includes("<img src=x>"));
assert.ok(html.includes('data-action="open-salon"'));
console.log("Testes da busca pública na tela inicial: OK");
