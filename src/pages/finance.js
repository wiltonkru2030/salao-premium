/**
 * Módulo Financeiro — SALÃO PREMIUM.
 * Consolida movimentações efetivas do caixa e compromissos registrados em despesas,
 * mantendo os dois conceitos separados para evitar duplicidade ou falsa leitura de saldo.
 * Todas as consultas são limitadas à organização ativa e continuam protegidas por RLS.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, metric } from "../utils.js";
import { reportError } from "../utils/errors.js";

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = value => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const movementLabel = value => ({ income: "Entrada", expense: "Saída", refund: "Estorno", reversal: "Reversão" })[value] || value || "Movimentação";
const expenseStatus = value => ({ pending: "Pendente", paid: "Paga", cancelled: "Cancelada" })[value] || value || "Sem status";

/** Renderiza a estrutura inicial do Financeiro enquanto os dados reais são consultados. */
export function financePage() {
  return head("Financeiro", "Acompanhe entradas e saídas efetivas do caixa e despesas cadastradas.") +
    '<div id="finance-manager"><div class="empty-state">Carregando informações financeiras…</div></div>';
}

/**
 * Consulta movimentos de caixa e despesas da organização ativa sem realizar mutações.
 * O período mensal usa o mês corrente no fuso local do navegador.
 * @returns {Promise<void>} Atualiza a interface com os dados financeiros consultados.
 */
export async function loadFinancePage() {
  const host = document.querySelector("#finance-manager");
  const orgId = state.organization?.id;
  if (!host || !orgId) return;

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startIso = monthStart.toISOString();
    const endIso = nextMonth.toISOString();

    const [movementResult, expenseResult] = await Promise.all([
      supabase.from("cash_movements")
        .select("id,movement_type,category,description,amount,payment_method,created_at,branch_id")
        .eq("org_id", orgId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("expenses")
        .select("id,description,category,amount,due_date,paid_at,status,supplier,created_at,branch_id")
        .eq("org_id", orgId)
        .order("due_date", { ascending: true })
        .limit(500)
    ]);
    if (movementResult.error) throw movementResult.error;
    if (expenseResult.error) throw expenseResult.error;

    const movements = movementResult.data || [];
    const expenses = expenseResult.data || [];
    const sum = (rows, predicate) => rows.filter(predicate).reduce((total, row) => total + Number(row.amount || 0), 0);
    const incoming = sum(movements, row => row.movement_type === "income");
    const outgoing = sum(movements, row => row.movement_type === "expense");
    const paidExpenses = sum(expenses, row => row.status === "paid" && row.paid_at && new Date(row.paid_at) >= monthStart && new Date(row.paid_at) < nextMonth);
    const pendingExpenses = sum(expenses, row => row.status === "pending");
    const movementRows = movements.map(row =>
      '<article class="record-card finance-record" data-search="' + esc((row.description || "") + " " + (row.category || "")).toLocaleLowerCase("pt-BR") + '">' +
      '<span class="record-main"><b>' + esc(row.description || movementLabel(row.movement_type)) + '</b>' +
      '<small>' + dateLabel(row.created_at) + ' · ' + esc(row.category || movementLabel(row.movement_type)) +
      (row.payment_method ? ' · ' + esc(row.payment_method.replaceAll("_", " ")) : "") + '</small></span>' +
      '<span class="record-trailing"><b>' + (row.movement_type === "expense" ? "−" : "+") + money(row.amount) + '</b>' +
      '<small>' + esc(movementLabel(row.movement_type)) + '</small></span></article>'
    ).join("");
    const expenseRows = expenses.map(row =>
      '<article class="record-card finance-expense" data-search="' + esc((row.description || "") + " " + (row.supplier || "") + " " + (row.category || "")).toLocaleLowerCase("pt-BR") + '">' +
      '<span class="record-main"><b>' + esc(row.description || "Despesa sem descrição") + '</b>' +
      '<small>' + esc(row.category || "Sem categoria") + (row.supplier ? ' · ' + esc(row.supplier) : "") +
      ' · Vencimento: ' + dateLabel(row.due_date) + '</small></span>' +
      '<span class="record-trailing"><b>' + money(row.amount) + '</b><small>' + esc(expenseStatus(row.status)) + '</small></span></article>'
    ).join("");

    host.innerHTML =
      '<div class="metrics">' +
      metric("Entradas no caixa", money(incoming), "movimentos efetivos", "mês atual") +
      metric("Saídas no caixa", money(outgoing), "movimentos efetivos", "mês atual") +
      metric("Resultado dos movimentos", money(incoming - outgoing), "entradas menos saídas", "não é conciliação bancária") +
      metric("Despesas pendentes", money(pendingExpenses), "despesas cadastradas", "pendentes ou atrasadas") +
      '</div>' +
      '<div class="surface finance-section"><div class="section-heading"><div><h2>Movimentações do caixa</h2><p>' +
      esc(monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })) +
      '</p></div><span class="result-count">' + movements.length + ' registros</span></div>' +
      '<p class="demo-note">Inclui somente movimentos registrados no caixa no mês atual. Estornos registrados como saídas já estão incluídos nas saídas do período.</p>' +
      '<div class="record-list">' + (movementRows || '<div class="empty-state">Nenhuma movimentação no caixa neste mês.</div>') + '</div></div>' +
      '<div class="surface finance-section"><div class="section-heading"><div><h2>Despesas cadastradas</h2><p>Despesas pagas no mês: ' + money(paidExpenses) + '</p></div>' +
      '<span class="result-count">' + expenses.length + ' registros</span></div>' +
      '<p class="demo-note">As despesas são compromissos cadastrados; não são somadas novamente às saídas do caixa. A lista considera até 500 registros.</p>' +
      '<div class="record-list">' + (expenseRows || '<div class="empty-state">Nenhuma despesa cadastrada.</div>') + '</div></div>';

  } catch (error) {
    const diagnostic = reportError(error, { context: "Financeiro > carregar indicadores", notify: false });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar o Financeiro.</b><small>Verifique sua conexão e suas permissões. Código ' + esc(diagnostic.id) + '</small></div>';
  }
}
