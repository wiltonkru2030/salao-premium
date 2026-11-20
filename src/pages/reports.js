/**
 * Módulo Relatórios — SALÃO PREMIUM.
 * Consolida indicadores operacionais e financeiros a partir dos registros persistidos.
 * Os conceitos de recebimento, movimento de caixa, atendimento e comissão permanecem separados.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import {renderReportsView} from "../modules/reports/reports.view.js";
import { head, esc } from "../utils.js";
import { reportError } from "../utils/errors.js";
import {queryReports} from "../modules/reports/reports.service.js";
import {calculateReportIndicators} from "../modules/reports/reports.rules.js";

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
  const userId=state.user?.id,role=state.membership?.role;
  const current=()=>host.isConnected&&state.user?.id===userId&&state.membership?.role===role&&state.organization?.id===orgId&&host.dataset.period===period&&host.dataset.request===request;
  const { start, end, startIso, endIso } = monthBounds(period);
  host.querySelector(".result-count").textContent = "Consultando " + dateLabel(start) + "…";

  try {
    const data=await queryReports({supabase,orgId,startIso,endIso});
    if(!current())return;
    const {payments,closedOrders,appointments}=data;
    const {received,refunded,cashIn,cashOut,generatedCommission,paidCommission,completedAppointments,cancelledAppointments,noShows,averageTicket,pendingOrders}=calculateReportIndicators(data);
    host.innerHTML=renderReportsView({period,start,payments,closedOrders,appointments,received,refunded,cashIn,cashOut,generatedCommission,paidCommission,completedAppointments,cancelledAppointments,noShows,averageTicket,pendingOrders});
    host.dataset.period = period;
  } catch (error) {
    if(!current())return;
    const diagnostic = reportError(error, { context: "Relatórios > consultar indicadores", notify: false });
    host.innerHTML = '<div class="list-toolbar reports-toolbar"><label>Período<input id="reports-month" type="month" value="' + esc(period) + '"></label><span class="result-count">Consulta indisponível</span><button type="button" class="btn secondary" data-retry-reports>Tentar novamente</button></div><div class="empty-state"><b>Não foi possível carregar os relatórios.</b><small>Verifique sua conexão e suas permissões. Código ' + esc(diagnostic.id) + '</small></div>';
  }
}

/** Registra a troca de mês sem recarregar a aplicação ou alterar dados financeiros. */
export function bindReportsPage() {
  const host = document.querySelector("#reports-manager");
  if (!host || host.dataset.bound === "true") return;
  host.dataset.bound = "true";
  host.addEventListener("click",event=>{if(event.target.closest("[data-retry-reports]"))loadReportsPage();});
  host.addEventListener("change", event => {
    if (event.target.matches("#reports-month")) {
      host.dataset.period = event.target.value;
      loadReportsPage();
    }
  });
}
