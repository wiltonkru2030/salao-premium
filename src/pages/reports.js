/**
 * Módulo Relatórios — SALÃO PREMIUM.
 * Consolida indicadores operacionais e financeiros a partir dos registros persistidos.
 * Os conceitos de recebimento, movimento de caixa, atendimento e comissão permanecem separados.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, metric } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { readFinancePages, sumFinanceAmounts } from "../modules/finance/finance-pagination.js";

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
  if (!["owner", "admin", "manager"].includes(state.membership?.role)) {
    host.innerHTML = '<div class="empty-state"><b>Acesso restrito.</b><small>Os relatórios estão disponíveis para proprietário, administrador e gerente.</small></div>';
    return;
  }

  const period = monthInput.value || dateInputValue(new Date());
  host.dataset.period = period;
  const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
  const current=()=>host.isConnected&&state.organization?.id===orgId&&host.dataset.period===period&&host.dataset.request===request;
  const { start, end, startIso, endIso } = monthBounds(period);
  host.querySelector(".result-count").textContent = "Consultando " + dateLabel(start) + "…";

  try {
    // Cada fonte utiliza uma data de referência própria; nenhuma lista tem limite silencioso.
    const query=(table,fields,dateField,configure=q=>q)=>()=>configure(supabase.from(table).select(fields).eq("org_id",orgId).gte(dateField,startIso).lt(dateField,endIso)).order(dateField,{ascending:false}).order("id",{ascending:false});
    const [payments,refunds,movements,closedOrders,orders,appointments,commissions,paidCommissions]=await Promise.all([
      readFinancePages(query("service_order_payments","id,amount,status,paid_at","paid_at")),
      readFinancePages(query("service_order_payments","id,amount,status,refunded_at","refunded_at",q=>q.eq("status","refunded"))),
      readFinancePages(query("cash_movements","id,movement_type,category,amount,created_at","created_at")),
      readFinancePages(query("service_orders","id,status,total,closed_at","closed_at",q=>q.eq("status","closed"))),
      readFinancePages(query("service_orders","id,status,created_at","created_at")),
      readFinancePages(query("appointments","id,status,starts_at","starts_at")),
      readFinancePages(query("commissions","id,amount,status,created_at","created_at")),
      readFinancePages(query("commissions","id,amount,paid_at","paid_at",q=>q.eq("status","paid")))
    ]);
    if(!current())return;
    const sum=sumFinanceAmounts;
    const received=sum(payments,row=>["confirmed","refunded"].includes(row.status));
    const refunded=sum(refunds);
    const cashIn=sum(movements,row=>row.movement_type==="income");
    const cashOut=sum(movements,row=>row.movement_type==="expense");
    const generatedCommission=sum(commissions,row=>row.status!=="cancelled");
    const paidCommission=sum(paidCommissions);
    const completedAppointments=appointments.filter(row=>row.status==="completed").length;
    const cancelledAppointments=appointments.filter(row=>row.status==="cancelled").length;
    const noShows=appointments.filter(row=>row.status==="no_show").length;
    const averageTicket=closedOrders.length?sum(closedOrders,()=>true,"total")/closedOrders.length:0;
    const pendingOrders=orders.filter(row=>["open","in_progress","awaiting_payment","partially_paid"].includes(row.status)).length;

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
      ["Recebimentos brutos", money(received), "Recebimentos no período, inclusive parcelas estornadas posteriormente"],
      ["Estornos de recebimentos",money(refunded),"Pela data efetiva da devolução"],
      ["Recebimentos líquidos",money(received-refunded),"Recebimentos brutos menos estornos do período; não somar ao Caixa"],
      ["Entradas registradas no Caixa", money(cashIn), "Movimentos de entrada registrados no período"],
      ["Saídas registradas no Caixa", money(cashOut), "Inclui despesas, comissões e estornos lançados como saída"],
      ["Resultado dos movimentos", money(cashIn - cashOut), "Entradas menos saídas; não é conciliação bancária"],
      ["Comissões geradas", money(generatedCommission), "Lançamentos criados no período, excluindo cancelados"],
      ["Comissões pagas", money(paidCommission), "Comissões efetivamente pagas no período, pela data do pagamento"]
    ].map(([label, value, note]) =>
      '<div class="record-card"><span class="record-main"><b>' + esc(label) + '</b><small>' + esc(note) + '</small></span><span class="record-trailing"><b>' + esc(value) + '</b></span></div>'
    ).join("");

    host.innerHTML =
      '<div class="list-toolbar reports-toolbar"><label class="search-box reports-month"><span>Período</span><input id="reports-month" type="month" value="' + esc(period) + '"></label><span class="result-count">' + esc(dateLabel(start)) + '</span></div>' +
      '<div class="metrics">' +
      metric("Recebimentos brutos", money(received), payments.filter(row => ["confirmed", "refunded"].includes(row.status)).length + " parcelas", "inclui recebimentos depois estornados; estornos aparecem nas saídas do Caixa") +
      metric("Ticket médio das comandas", money(averageTicket), closedOrders.length + " comandas fechadas", "média do total das comandas encerradas no período") +
      metric("Atendimentos concluídos", String(completedAppointments), appointments.length + " agendamentos no período", "por data e hora agendada") +
      metric("Comandas do mês em aberto", String(pendingOrders), "comandas não finalizadas", "inclui parciais e aguardando pagamento") +
      '</div>' +
      '<section class="surface finance-section"><div class="section-heading"><div><h2>Resumo financeiro</h2><p>Valores registrados em ' + esc(dateLabel(start)) + '</p></div></div><div class="record-list">' + summaryRows + '</div></section>' +
      '<section class="surface finance-section"><div class="section-heading"><div><h2>Atendimentos</h2><p>Distribuição dos agendamentos por status</p></div><span class="result-count">' + appointments.length + ' registros</span></div><div class="record-list">' + statusRows + '</div></section>' +
      '<p class="demo-note">Relatório somente leitura. Cada indicador usa sua própria fonte e data de referência. Todas as páginas são consultadas; mudanças simultâneas podem exigir nova consulta. Recebimentos não são somados novamente às entradas do Caixa.</p>';
    host.dataset.period = period;
  } catch (error) {
    if(!current())return;
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
