/**
 * Módulo: Produtos e estoque.
 * Cadastro e manutenção do catálogo. O saldo de estoque não é editado aqui:
 * entradas e baixas devem ser registradas pelo fluxo próprio de estoque/venda.
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
          <div><h2 id="product-modal-title">Novo produto</h2><p id="product-modal-description">Cadastre o produto e defina os valores e o estoque inicial.</p></div>
          <button class="sp-modal-close" type="button" data-close-product-modal aria-label="Fechar">×</button>
        </header>
        <form id="product-create-form">
          <div class="sp-modal-body">
            <label class="sp-span">Nome do produto<input name="name" required maxlength="120" placeholder="Nome do produto"></label>
            <label>SKU / Código<input name="sku" maxlength="80" placeholder="Código interno"></label>
            <label>Categoria<input name="category" maxlength="80" placeholder="Ex.: Cuidados capilares"></label>
            <label>Custo (R$)<input name="cost_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>
            <label>Preço de venda (R$)<input name="sale_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>
            <label id="product-stock-field">Estoque inicial<input name="stock_quantity" type="number" min="0" step="0.001" value="0"></label>
            <label>Estoque mínimo<input name="min_stock" type="number" min="0" step="0.001" value="0"></label>
            <p class="demo-note sp-span" id="product-stock-note" hidden>O saldo atual não é alterado na edição para preservar o histórico de estoque.</p>
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
        <span class="record-trailing"><b>${money(product.sale_price)}</b><small>${product.active ? "Ativo" : "Inativo"}</small>
          <span class="record-actions"><button class="btn secondary" type="button" data-edit-product="${product.id}">Editar</button><button class="btn secondary" type="button" data-toggle-product="${product.id}" data-active="${product.active ? "true" : "false"}">${product.active ? "Desativar" : "Ativar"}</button></span>
        </span>
      </article>`).join("") || '<div class="empty-state">Nenhum produto cadastrado.</div>'}
    </div>`;

  if (host.dataset.bound === "true") return;
  host.dataset.bound = "true";
  if (!modalListenerInstalled) {
    modalListenerInstalled = true;
    document.addEventListener("click", event => {
      const dialog = document.querySelector("#product-create-modal");
      if (!dialog) return;
      if (event.target.closest('[data-action="open-product-modal"]')) {
        const form = dialog.querySelector("#product-create-form");
        form.reset(); form.dataset.productId = "";
        dialog.querySelector("#product-modal-title").textContent = "Novo produto";
        dialog.querySelector("#product-modal-description").textContent = "Cadastre o produto e defina os valores e o estoque inicial.";
        dialog.querySelector("#product-stock-field").hidden = false;
        dialog.querySelector("#product-stock-note").hidden = true;
        form.querySelector('[type="submit"]').textContent = "Cadastrar produto";
        if (!dialog.open) dialog.showModal();
      } else if (event.target.closest("[data-close-product-modal]") || event.target === dialog) {
        if (dialog.open) dialog.close();
      }
    });
  }

  host.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-product]");
    if (edit) {
      const product = products.find(item => item.id === edit.dataset.editProduct);
      const dialog = host.querySelector("#product-create-modal");
      if (!product || !dialog) return;
      const form = dialog.querySelector("#product-create-form");
      form.dataset.productId = product.id;
      for (const key of ["name", "sku", "category", "min_stock"]) form.elements[key].value = product[key] ?? "";
      form.elements.cost_price.value = Number(product.cost_price || 0).toFixed(2).replace(".", ",");
      form.elements.sale_price.value = Number(product.sale_price || 0).toFixed(2).replace(".", ",");
      dialog.querySelector("#product-modal-title").textContent = "Editar produto";
      dialog.querySelector("#product-modal-description").textContent = "Atualize os dados comerciais sem alterar o saldo do estoque.";
      dialog.querySelector("#product-stock-field").hidden = true;
      dialog.querySelector("#product-stock-note").hidden = false;
      form.querySelector('[type="submit"]').textContent = "Salvar alterações";
      dialog.showModal();
      return;
    }
    const toggle = event.target.closest("[data-toggle-product]");
    if (toggle) {
      const active = toggle.dataset.active === "true";
      if (!window.confirm(active ? "Desativar este produto? Ele deixará de aparecer para novos lançamentos." : "Reativar este produto?")) return;
      toggle.disabled = true;
      try {
        const { error } = await supabase.from("products").update({ active: !active })
          .eq("org_id", state.organization.id).eq("id", toggle.dataset.toggleProduct);
        if (error) throw error;
        toast(active ? "Produto desativado." : "Produto reativado.");
        await loadProductsPage();
      } catch (error) {
        reportError(error, { context: "Produtos > alterar situação" });
        toggle.disabled = false;
      }
    }
  });

  host.addEventListener("submit", async event => {
    if (!event.target.matches("#product-create-form")) return;
    event.preventDefault();
    const form = event.target, values = new FormData(form), submit = form.querySelector('[type="submit"]');
    const name = String(values.get("name") || "").trim();
    const cost = parseBRL(values.get("cost_price")), price = parseBRL(values.get("sale_price"));
    const stock = Number(values.get("stock_quantity") || 0), minStock = Number(values.get("min_stock") || 0);
    if (!name || ![cost, price, minStock].every(Number.isFinite) || [cost, price, minStock].some(value => value < 0) ||
        (!form.dataset.productId && (!Number.isFinite(stock) || stock < 0))) {
      toast("Confira os dados e os valores do produto."); return;
    }
    submit.disabled = true;
    try {
      const payload = {
        name, sku: String(values.get("sku") || "").trim() || null,
        category: String(values.get("category") || "").trim() || null,
        cost_price: cost, sale_price: price, min_stock: minStock
      };
      const productId = form.dataset.productId;
      const result = productId
        ? await supabase.from("products").update(payload).eq("org_id", state.organization.id).eq("id", productId)
        : await supabase.from("products").insert({ ...payload, org_id: state.organization.id, stock_quantity: stock, active: true });
      if (result.error) throw result.error;
      host.querySelector("#product-create-modal")?.close();
      toast(productId ? "Produto atualizado." : "Produto cadastrado.");
      await loadProductsPage();
    } catch (error) {
      reportError(error, { context: "Produtos > salvar cadastro" });
    } finally { submit.disabled = false; }
  });
}
