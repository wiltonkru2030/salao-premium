/** Apresentação do Financeiro: indicadores e listas, sem consultas ou eventos. */
import {esc,metric} from "../../utils.js";
import {sumFinanceAmounts} from "./finance-pagination.js";
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = value => value ? new Date(String(value).length===10?value+"T12:00:00":value).toLocaleDateString("pt-BR") : "—";
const movementLabel = value => ({ income: "Entrada", expense: "Saída", refund: "Estorno", reversal: "Reversão" })[value] || value || "Movimentação";
const expenseStatus = value => ({ pending: "Pendente", paid: "Paga", cancelled: "Cancelada" })[value] || value || "Sem status";


/** Renderiza o resumo mensal e as despesas sem duplicar saídas efetivas. */
export function renderFinanceWorkspace({movements,expenses,monthStart,nextMonth}){
    const sum=sumFinanceAmounts;
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

    return '<div class="metrics">' +
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
      '<p class="demo-note">As despesas são compromissos cadastrados; não são somadas novamente às saídas do caixa. O resultado inclui todas as páginas consultadas.</p>' +
      '<div class="record-list">' + (expenseRows || '<div class="empty-state">Nenhuma despesa cadastrada.</div>') + '</div></div>';

}
