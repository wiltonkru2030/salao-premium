/**
 * Listagens operacionais de Vendas, Financeiro, Relatórios e Unidades.
 * Os dados são sempre consultados no Supabase com escopo do tenant ativo.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, status } from "../utils.js";
import { reportError } from "../utils/errors.js";

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = value => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const hostId = "records-manager";
let recordsLoadSequence=0;

export function cardList(name) {
  return head(name, descriptions[name] || "Consulte os registros da organização ativa.") +
    '<div id="' + hostId + '"><div class="empty-state">Carregando registros…</div></div>';
}

const descriptions = {
  Vendas: "Vendas e recebimentos registrados para o salão.",
  Financeiro: "Movimentações financeiras e despesas da organização.",
  Relatórios: "Indicadores calculados a partir dos registros reais.",
  Unidades: "Unidades cadastradas nesta organização."
};

function row(title, detail, value, stateLabel) {
  return '<article class="record-card"><span class="record-main"><b>' + esc(title) +
    '</b><small>' + esc(detail || "Sem detalhes adicionais") +
    '</small></span><span class="record-trailing"><b>' + esc(value || "—") +
    '</b>' + (stateLabel ? status(stateLabel) : "") + '</span></article>';
}

function empty(message) {
  return '<div class="empty-state">' + esc(message) + '</div>';
}

/** Carrega a listagem correspondente à página ativa. */
export async function loadRecordsPage() {
  const host = document.getElementById(hostId);
  const orgId = state.organization?.id;
  const page = state.page;
  if (!host || !orgId) return;
  const requestId=++recordsLoadSequence,branchId=state.branch?.id||null;
  const branchFilter=query=>branchId?query.eq("branch_id",branchId):query.is("branch_id",null);

  host.innerHTML = '<div class="empty-state">Consultando o banco de dados…</div>';
  try {
    let html = "";
    if (page === "Vendas") {
      const { data, error } = await branchFilter(supabase.from("sales").select("*")
        .eq("org_id", orgId)).order("sold_at", { ascending: false }).limit(200);
      if (error) throw error;
      html = (data || []).map(sale => row(
        "Venda #" + (sale.sale_number || String(sale.id || "").slice(0, 8)),
        date(sale.sold_at || sale.created_at) + " · " + (sale.payment_method || "Forma de pagamento não informada"),
        money(sale.total), sale.status || "Registrada"
      )).join("") || empty("Nenhuma venda registrada.");
    } else if (page === "Financeiro") {
      const [movementResult, expenseResult] = await Promise.all([
        branchFilter(supabase.from("cash_movements").select("*").eq("org_id", orgId))
          .order("created_at", { ascending: false }).limit(200),
        branchFilter(supabase.from("expenses").select("*").eq("org_id", orgId))
          .order("created_at", { ascending: false }).limit(200)
      ]);
      if (movementResult.error) throw movementResult.error;
      if (expenseResult.error) throw expenseResult.error;
      const movements = (movementResult.data || []).map(item => ({
        date: item.created_at, title: item.description || item.category || "Movimentação de caixa",
        detail: item.payment_method || item.category || "Caixa",
        value: (item.movement_type === "expense" ? "− " : "+ ") + money(item.amount),
        state: item.movement_type === "expense" ? "Saída" : "Entrada"
      }));
      const expenses = (expenseResult.data || []).map(item => ({
        date: item.created_at, title: item.description || "Despesa",
        detail: "Despesa cadastrada", value: money(item.amount),
        state: item.status || "Pendente"
      }));
      html = [...movements, ...expenses].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .map(item => row(item.title, date(item.date) + " · " + item.detail, item.value, item.state)).join("") ||
        empty("Nenhuma movimentação ou despesa encontrada.");
    } else if (page === "Relatórios") {
      const [salesResult, appointmentsResult, customersResult, professionalsResult] = await Promise.all([
        branchFilter(supabase.from("sales").select("id,total,status", { count: "exact" }).eq("org_id", orgId)).limit(1000),
        branchFilter(supabase.from("appointments").select("id,status", { count: "exact" }).eq("org_id", orgId)).limit(1000),
        branchFilter(supabase.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("active", true)),
        branchFilter(supabase.from("professionals").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("active", true))
      ]);
      for (const result of [salesResult, appointmentsResult, customersResult, professionalsResult]) {
        if (result.error) throw result.error;
      }
      const sales = salesResult.data || [];
      const appointments = appointmentsResult.data || [];
      const total = sales.reduce((sum, item) => sum + Number(item.total || 0), 0);
      html = [
        row("Vendas registradas", "Quantidade consultada no banco", String(salesResult.count ?? sales.length), "Atualizado"),
        row("Valor total das vendas consultadas", "Soma dos registros retornados (limite de 1.000)", money(total), "Informativo"),
        row("Agendamentos registrados", "Quantidade consultada no banco", String(appointmentsResult.count ?? appointments.length), "Atualizado"),
        row("Clientes ativos", "Cadastro da organização", String(customersResult.count ?? 0), "Atualizado"),
        row("Profissionais ativos", "Equipe da organização", String(professionalsResult.count ?? 0), "Atualizado")
      ].join("");
    } else if (page === "Unidades") {
      const { data, error } = await supabase.from("branches").select("*")
        .eq("org_id", orgId).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      html = (data || []).map(branch => row(
        branch.name || "Unidade sem nome",
        branch.is_main ? "Unidade matriz" : "Filial",
        branch.active === false ? "Inativa" : "Ativa",
        branch.active === false ? "Inativo" : "Ativo"
      )).join("") || empty("Nenhuma unidade cadastrada.");
    } else {
      html = empty("Este módulo ainda não possui uma listagem operacional.");
    }
    if(requestId!==recordsLoadSequence||state.organization?.id!==orgId||(state.branch?.id||null)!==branchId||state.page!==page||!host.isConnected)return;
    host.innerHTML = '<div class="record-list">' + html + '</div>';
  } catch (error) {
    if(requestId!==recordsLoadSequence||state.organization?.id!==orgId||(state.branch?.id||null)!==branchId||state.page!==page||!host.isConnected)return;
    reportError(error, { context: page + " > carregar registros" });
    host.innerHTML = empty("Não foi possível carregar os registros. Verifique a conexão, as permissões e a estrutura do banco.");
  }
}
