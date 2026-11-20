/**
 * Módulo Vendas — SALÃO PREMIUM.
 * Consulta vendas e itens persistidos no Supabase, sempre limitados à organização ativa.
 * O schema atual concede SELECT aos perfis financeiros; não há política de INSERT/UPDATE
 * para estas tabelas. Por segurança, esta tela é somente leitura e não simula novos lançamentos.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, metric } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { fetchSalesWorkspace } from "../modules/sales/sales.service.js";

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = value => value ? new Date(value).toLocaleString("pt-BR") : "—";
const paymentLabels = { pix: "PIX", cash: "Dinheiro", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", transfer: "Transferência", voucher: "Voucher", other: "Outro" };
const statusLabels = { open: "Em aberto", paid: "Paga", cancelled: "Cancelada", refunded: "Estornada" };

/** Renderiza a estrutura da página Vendas com estado inicial de carregamento. */
export function salesPage() {
  return head("Vendas", "Consulte as vendas registradas para sua organização.") +
    '<div id="sales-manager"><div class="empty-state">Carregando vendas…</div></div>';
}

/** Consulta cabeçalhos, clientes e itens de venda sem realizar mutações financeiras. */
export async function loadSalesPage() {
  const host = document.querySelector("#sales-manager");
  const orgId = state.organization?.id;
  if (!host || !orgId) return;

  let rows,customers,itemsBySale;
  try {
    ({sales:rows,customers,itemsBySale}=await fetchSalesWorkspace({client:supabase,orgId,branchId:state.branch?.id||null,limit:200}));
  } catch(error) {
    if (!host.isConnected || state.organization?.id !== orgId) return;
    reportError(error,{context:"Vendas > carregar histórico"});
    host.innerHTML='<div class="empty-state"><b>Não foi possível carregar as vendas.</b><small>Verifique sua conexão e suas permissões. Tente novamente.</small></div>';
    return;
  }

  if (!host.isConnected || state.organization?.id !== orgId) return;
  try {
    const totalSales = rows.length;
    const gross = rows.filter(row => row.status !== "cancelled" && row.status !== "refunded")
      .reduce((sum, row) => sum + Number(row.total || 0), 0);
    const completed = rows.filter(row => row.status === "paid").length;
    const cards = rows.map(row => {
      const items = itemsBySale.get(row.id) || [];
      const customer = row.customer_id ? customers.get(row.customer_id) || "Cliente não localizado" : "Consumidor não identificado";
      const detail = items.length ? items.map(item =>
        '<li><span>' + esc(item.description) + ' × ' + esc(item.quantity) + '</span><b>' + money(item.total) + '</b></li>'
      ).join("") : '<li>Esta venda não possui itens detalhados.</li>';
      return '<article class="record-card sales-record">' +
        '<span class="record-main"><b>Venda #' + esc(row.sale_number) + ' · ' + esc(customer) + '</b>' +
        '<small>' + dateTime(row.sold_at) + ' · ' + esc(paymentLabels[row.payment_method] || "Pagamento não informado") + '</small>' +
        '<small>' + items.length + ' item(ns) · Desconto: ' + money(row.discount) + '</small></span>' +
        '<span class="record-trailing"><b>' + money(row.total) + '</b><small>' + esc(statusLabels[row.status] || row.status || "Sem status") + '</small>' +
        '<button class="btn secondary" type="button" data-sale-detail="' + esc(row.id) + '" aria-expanded="false">Ver itens</button></span>' +
        '<ul class="sales-items" data-sale-items="' + esc(row.id) + '" hidden>' + detail + '</ul></article>';
    }).join("");

    host.innerHTML =
      '<div class="metrics">' +
      metric("Vendas no histórico", String(totalSales), "registros consultados", "até 200 mais recentes") +
      metric("Vendas pagas", String(completed), "status pago", "sem contar vendas canceladas") +
      metric("Total listado", money(gross), "vendas não canceladas/estornadas", "não representa saldo de caixa") +
      '</div>' +
      '<div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="sales-search" type="search" placeholder="Buscar por venda ou cliente…"></label>' +
      '<span class="result-count">Até 200 vendas mais recentes</span></div>' +
      '<div class="record-list" id="sales-list">' + (cards || '<div class="empty-state"><b>Nenhuma venda encontrada</b><small>As vendas registradas aparecerão aqui.</small></div>') + '</div>' +
      '<p class="demo-note">Consulta somente leitura. O total listado não representa necessariamente recebimentos confirmados; confira o Caixa para entradas e estornos.</p>';

    if (host.dataset.bound !== "true") {
      host.dataset.bound = "true";
      host.addEventListener("input", event => {
        if (!event.target.matches("#sales-search")) return;
        const term = event.target.value.trim().toLocaleLowerCase("pt-BR");
        host.querySelectorAll(".sales-record").forEach(card => {
          card.hidden = !card.textContent.toLocaleLowerCase("pt-BR").includes(term);
        });
      });
      host.addEventListener("click", event => {
        const button = event.target.closest("[data-sale-detail]");
        if (!button) return;
        const detail = host.querySelector('[data-sale-items="' + CSS.escape(button.dataset.saleDetail) + '"]');
        if (!detail) return;
        detail.hidden = !detail.hidden;
        button.setAttribute("aria-expanded", String(!detail.hidden));
        button.textContent = detail.hidden ? "Ver itens" : "Ocultar itens";
      });
    }
  } catch (error) {
    reportError(error, { context: "Vendas > consultar histórico" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar as vendas.</b><small>Verifique sua conexão e suas permissões e tente novamente.</small></div>';
  }
}
