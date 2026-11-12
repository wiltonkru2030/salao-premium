/**
 * Módulo: Produtos e estoque.
 * Responsabilidade: consultar produtos e cadastrar itens/estoque inicial pelo modal global.
 * Não faz: movimentar estoque de vendas ou registrar pagamentos.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL } from "../utils/input-masks.js";
import { reportError } from "../utils/errors.js";

let modalListenerInstalled = false;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function productsPage() {
  return head("Produtos e estoque", "Cadastre produtos e acompanhe preço e quantidade disponível.",
    btn("＋ Novo produto", "open-product-modal", "primary")) +
    '<div id="products-manager"><div class="empty-state">Carregando produtos…</div></div>';
}

/** Consulta a lista e mantém os eventos do modal conectados apenas uma vez. */
export async function loadProductsPage() {
  const host = document.querySelector("#products-manager");
  if (!host || !state.organization?.id) return;

  let products;
  try {
    const result = await supabase.from("products")
      .select("id,name,sku,category,cost_price,sale_price,stock_quantity,min_stock,active")
      .eq("org_id", state.organization.id).order("name").limit(500);
    if (result.error) throw result.error;
    products = result.data || [];
  } catch (error) {
    reportError(error, { context: "Produtos > carregar lista" });
    host.innerHTML = '<div class="empty-state">Não foi possível carregar os produtos. Atualize a página e tente novamente.</div>';
    return;
  }

  host.innerHTML = `
    <dialog class="sp-modal" id="product-create-modal" aria-labelledby="product-modal-title">
      <div class="sp-modal-shell">
        <header class="sp-modal-head">
          <div><h2 id="product-modal-title">Novo produto</h2><p>Cadastre o produto e defina os valores e o estoque inicial.</p></div>
          <button class="sp-modal-close" type="button" data-close-product-modal aria-label="Fechar">×</button>
        </header>
        <form id="product-create-form">
          <div class="sp-modal-body">
            <label class="sp-span">Nome do produto<input name="name" required maxlength="120" placeholder="Nome do produto"></label>
            <label>SKU / Código<input name="sku" placeholder="Código interno"></label>
            <label>Categoria<input name="category" placeholder="Ex.: Cuidados capilares"></label>
            <label>Custo (R$)<input name="cost_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>
            <label>Preço de venda (R$)<input name="sale_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>
            <label>Estoque inicial<input name="stock_quantity" type="number" min="0" step="0.001" value="0"></label>
            <label>Estoque mínimo<input name="min_stock" type="number" min="0" step="0.001" value="0"></label>
          </div>
          <footer class="sp-modal-foot">
            <button class="btn secondary" type="button" data-close-product-modal>Cancelar</button>
            <button class="btn primary" type="submit">Cadastrar produto</button>
          </footer>
        </form>
      </div>
    </dialog>
    <div class="list-toolbar"><span class="result-count">${products.length} produtos</span></div>
    <div class="record-list">${products.map(product => `
      <article class="record-card">
        <span class="record-main"><b>${esc(product.name)}</b><small>${esc(product.sku || "Sem SKU")} · ${esc(product.category || "Sem categoria")}</small><small>Estoque: ${Number(product.stock_quantity)} · Mínimo: ${Number(product.min_stock)}</small></span>
        <span class="record-trailing"><b>${money(product.sale_price)}</b><small>${product.active ? "Ativo" : "Inativo"}</small></span>
      </article>`).join("") || '<div class="empty-state">Nenhum produto cadastrado.</div>'}
    </div>`;

  if (host.dataset.bound === "true") return;
  host.dataset.bound = "true";

  // O botão do cabeçalho fica fora do host; por isso o clique é delegado ao documento.
  if (!modalListenerInstalled) {
    modalListenerInstalled = true;
    document.addEventListener("click", event => {
    const dialog = document.querySelector("#product-create-modal");
    if (!dialog) return;
    if (event.target.closest('[data-action="open-product-modal"]')) {
      if (!dialog.open) dialog.showModal();
    } else if (event.target.closest("[data-close-product-modal]") || event.target === dialog) {
      if (dialog.open) dialog.close();
    }
    });
  }

  host.addEventListener("submit", async event => {
    if (!event.target.matches("#product-create-form")) return;
    event.preventDefault();

    const form = event.target;
    const values = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const name = String(values.get("name") || "").trim();
    const cost = parseBRL(values.get("cost_price"));
    const price = parseBRL(values.get("sale_price"));
    const stock = Number(values.get("stock_quantity") || 0);
    const minStock = Number(values.get("min_stock") || 0);

    if (!name || ![cost, price, stock, minStock].every(Number.isFinite) ||
        [cost, price, stock, minStock].some(value => value < 0)) {
      toast("Confira os dados e os valores do produto.");
      return;
    }

    submit.disabled = true;
    try {
      const { error } = await supabase.from("products").insert({
        org_id: state.organization.id,
        name,
        sku: String(values.get("sku") || "").trim() || null,
        category: String(values.get("category") || "").trim() || null,
        cost_price: cost,
        sale_price: price,
        stock_quantity: stock,
        min_stock: minStock,
        active: true
      });
      if (error) throw error;
      host.querySelector("#product-create-modal")?.close();
      toast("Produto cadastrado.");
      await loadProductsPage();
    } catch (error) {
      reportError(error, { context: "Produtos > salvar cadastro" });
    } finally {
      submit.disabled = false;
    }
  });
}
