/**
 * Módulo Relatórios — SALÃO PREMIUM.
 * Consolida indicadores operacionais e financeiros a partir dos registros persistidos.
 * Os conceitos de recebimento, movimento de caixa, atendimento e comissão permanecem separados.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, metric } from "../utils.js";
import { reportError } from "../utils/errors.js";

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateInputValue = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0")].join("-");
const monthBounds = value => {
  const [year, month] = value.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
};
const dateLabel = value => value.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

/** Renderiza os filtros e o estado inicial do relatório mensal. */
export function reportsPage() {
  const month = dateInputValue(new Date());
  return head("Relatórios", "Indicadores operacionais e financeiros calculados a partir dos registros do salão.") +
    '<div id="reports-manager"><div class="list-toolbar reports-toolbar"><label class="search-box reports-month"><span>Período</span><input id="reports-month" type="month" value="' + month + '"></label><span class="result-count">Atualize o período para consultar os indicadores.</span></div><div class="empty-state">Carregando relatórios…</div></div>';
}

/**
 * Consulta recebimentos, caixa, comandas, atendimentos e comissões do tenant ativo.
 * A consulta é somente leitura e limitada ao mês escolhido pelo usuário.
 * @returns {Promise<void>} Atualiza a interface com os indicadores consultados.
 */
export async function loadReportsPage() {
  const host = document.querySelector("#reports-manager");
  const orgId = state.organization?.id;
  const monthInput = host?.querySelector("#reports-month");
  if (!host || !orgId || !monthInput) return;

  const period = monthInput.value || dateInputValue(new Date());
  host.dataset.period = period;
  const { start, end, startIso, endIso } = monthBounds(period);
  host.querySelector(".result-count").textContent = "Consultando " + dateLabel(start) + "…";

  try {
    const [paymentsResult, movementsResult, ordersResult, appointmentsResult, commissionsResult] = await Promise.all([
      supabase.from("service_order_payments")
        .select("id,order_id,amount,status,paid_at,refunded_at")
        .eq("org_id", orgId).gte("paid_at", startIso).lt("paid_at", endIso)
        .order("paid_at", { ascending: false }).limit(2000),
      supabase.from("cash_movements")
        .select("id,movement_type,category,amount,created_at")
        .eq("org_id", orgId).gte("created_at", startIso).lt("created_at", endIso)
        .order("created_at", { ascending: false }).limit(2000),
      supabase.from("service_orders")
        .select("id,status,total,closed_at,created_at")
        .eq("org_id", orgId).gte("created_at", startIso).lt("created_at", endIso)
        .order("created_at", { ascending: false }).limit(2000),
      supabase.from("appointments")
        .select("id,status,starts_at")
        .eq("org_id", orgId).gte("starts_at", startIso).lt("starts_at", endIso)
        .order("starts_at", { ascending: false }).limit(2000),
      supabase.from("commissions")
        .select("id,professional_id,amount,status,created_at")
        .eq("org_id", orgId).gte("created_at", startIso).lt("created_at", endIso)
        .order("created_at", { ascending: false }).limit(2000)
    ]);
    for (const result of [paymentsResult, movementsResult, ordersResult, appointmentsResult, commissionsResult]) {
      if (result.error) throw result.error;
    }
    if (state.organization?.id !== orgId || host.dataset.period !== period) return;

    const payments = paymentsResult.data || [];
    const movements = movementsResult.data || [];
    const orders = ordersResult.data || [];
    const appointments = appointmentsResult.data || [];
    const commissions = commissionsResult.data || [];
    const sum = (rows, predicate) => rows.filter(predicate).reduce((total, row) => total + Number(row.amount || 0), 0);
    const received = sum(payments, row => row.status === "confirmed");
    const cashIn = sum(movements, row => row.movement_type === "income");
    const cashOut = sum(movements, row => row.movement_type === "expense");
    const generatedCommission = sum(commissions, () => true);
    const paidCommission = sum(commissions, row => row.status === "paid");
    const completedAppointments = appointments.filter(row => row.status === "completed").length;
    const cancelledAppointments = appointments.filter(row => row.status === "cancelled").length;
    const noShows = appointments.filter(row => row.status === "no_show").length;
    const closedOrders = orders.filter(row => row.status === "closed");
    const averageTicket = closedOrders.length ? closedOrders.reduce((total, row) => total + Number(row.total || 0), 0) / closedOrders.length : 0;
    const pendingOrders = orders.filter(row => ["open", "in_progress", "awaiting_payment", "partially_paid"].includes(row.status)).length;

    const appointmentStatus = [
      ["Concluídos", completedAppointments],
      ["Cancelados", cancelledAppointments],
      ["Não compareceram", noShows],
      ["Outros status", appointments.length - completedAppointments - cancelledAppointments - noShows]
    ];
    const statusRows = appointmentStatus.map(([label, count]) =>
      '<div class="record-card"><span class="record-main"><b>' + label + '</b></span><span class="record-trailing"><b>' + count + '</b></span></div>'
    ).join("");

    const summaryRows = [
      ["Recebimentos confirmados", money(received), "Pagamentos de Comandas com status confirmado no período"],
      ["Entradas registradas no Caixa", money(cashIn), "Movimentos de entrada registrados no período"],
      ["Saídas registradas no Caixa", money(cashOut), "Inclui despesas, comissões e estornos lançados como saída"],
      ["Resultado dos movimentos", money(cashIn - cashOut), "Entradas menos saídas; não é conciliação bancária"],
      ["Comissões geradas", money(generatedCommission), "Lançamentos criados no período, inclusive pendentes e cancelados"],
      ["Comissões pagas", money(paidCommission), "Lançamentos com status pago criados no período"]
    ].map(([label, value, note]) =>
      '<div class="record-card"><span class="record-main"><b>' + esc(label) + '</b><small>' + esc(note) + '</small></span><span class="record-trailing"><b>' + esc(value) + '</b></span></div>'
    ).join("");

    host.innerHTML =
      '<div class="list-toolbar reports-toolbar"><label class="search-box reports-month"><span>Período</span><input id="reports-month" type="month" value="' + esc(period) + '"></label><span class="result-count">' + esc(dateLabel(start)) + '</span></div>' +
      '<div class="metrics">' +
      metric("Recebimentos confirmados", money(received), payments.filter(row => row.status === "confirmed").length + " parcelas", "não inclui parcelas estornadas") +
      metric("Ticket médio das comandas", money(averageTicket), closedOrders.length + " comandas fechadas", "média do total das comandas fechadas criadas no período") +
      metric("Atendimentos concluídos", String(completedAppointments), appointments.length + " agendamentos no período", "por data e hora agendada") +
      metric("Comandas em aberto", String(pendingOrders), "comandas não finalizadas", "inclui parciais e aguardando pagamento") +
      '</div>' +
      '<section class="surface finance-section"><div class="section-heading"><div><h2>Resumo financeiro</h2><p>Valores registrados em ' + esc(dateLabel(start)) + '</p></div></div><div class="record-list">' + summaryRows + '</div></section>' +
      '<section class="surface finance-section"><div class="section-heading"><div><h2>Atendimentos</h2><p>Distribuição dos agendamentos por status</p></div><span class="result-count">' + appointments.length + ' registros</span></div><div class="record-list">' + statusRows + '</div></section>' +
      '<p class="demo-note">Relatório somente leitura. Cada indicador usa sua própria fonte e data de referência. As consultas consideram até 2.000 registros por conjunto; para períodos com volume maior, será necessário consolidar os dados no banco. Recebimentos não são somados novamente às entradas do Caixa.</p>';
    host.dataset.period = period;
  } catch (error) {
    const diagnostic = reportError(error, { context: "Relatórios > consultar indicadores", notify: false });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar os relatórios.</b><small>Verifique sua conexão e suas permissões. Código ' + esc(diagnostic.id) + '</small></div>';
  }
}

/** Registra a troca de mês sem recarregar a aplicação ou alterar dados financeiros. */
export function bindReportsPage() {
  const host = document.querySelector("#reports-manager");
  if (!host || host.dataset.bound === "true") return;
  host.dataset.bound = "true";
  host.addEventListener("change", event => {
    if (event.target.matches("#reports-month")) {
      host.dataset.period = event.target.value;
      loadReportsPage();
    }
  });
}
