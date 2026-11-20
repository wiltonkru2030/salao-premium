/** Apresentação dos relatórios: métricas e listas sem consultas ao banco. */
import {esc,metric} from "../../utils.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateLabel=value=>value.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
/** Renderiza os indicadores do período selecionado. */
export function renderReportsView({period,start,payments,closedOrders,appointments,received,refunded,cashIn,cashOut,generatedCommission,paidCommission,completedAppointments,cancelledAppointments,noShows,averageTicket,pendingOrders}){
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

    return
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

}
