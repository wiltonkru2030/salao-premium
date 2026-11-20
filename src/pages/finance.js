/**
 * Módulo Financeiro — SALÃO PREMIUM.
 * Consolida movimentações efetivas do caixa e compromissos registrados em despesas,
 * mantendo os dois conceitos separados para evitar duplicidade ou falsa leitura de saldo.
 * Todas as consultas são limitadas à organização ativa e continuam protegidas por RLS.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { renderFinanceWorkspace } from "../modules/finance/finance.view.js";
import { fetchFinanceWorkspace } from "../modules/finance/finance.service.js";

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

  const branchId=state.branch?.id||null,userId=state.user?.id;
  const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
  const current=()=>host.isConnected&&state.page==='Financeiro'&&state.organization?.id===orgId&&(state.branch?.id||null)===branchId&&state.user?.id===userId&&host.dataset.request===request;
  host.textContent="Carregando informações financeiras…";
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startIso = monthStart.toISOString();
    const endIso = nextMonth.toISOString();

    const {movements,expenses}=await fetchFinanceWorkspace({
      client:supabase,orgId,branchId,startIso,endIso,limit:500
    });

    if(!current())return;
    host.innerHTML=renderFinanceWorkspace({movements,expenses,monthStart,nextMonth});

  } catch (error) {
    if(!current())return;
    const diagnostic = reportError(error, { context: "Financeiro > carregar indicadores", notify: false });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar o Financeiro.</b><small>Verifique sua conexão e suas permissões. Código ' + esc(diagnostic.id) + '</small></div>';
  }
}
