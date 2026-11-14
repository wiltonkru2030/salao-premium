/**
 * Dashboard operacional.
 * Exibe somente dados consultados no tenant ativo; nunca usa métricas fictícias.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, status } from "../utils.js";
import { reportError } from "../utils/errors.js";

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = value => value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

export function dashboard() {
  return head("Visão geral", "Acompanhe a operação real do seu salão.") +
    '<div id="dashboard-manager"><div class="empty-state">Carregando indicadores do salão…</div></div>';
}

/** Consulta indicadores e próximos atendimentos da organização/unidade ativa. */
export async function loadDashboardPage() {
  const host = document.querySelector("#dashboard-manager");
  const orgId = state.organization?.id;
  if (!host || !orgId) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  try {
    let appointmentsQuery = supabase.from("appointments")
      .select("id,starts_at,customer_name,service_name,professional_name,status,price")
      .eq("org_id", orgId).gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString()).order("starts_at").limit(8);
    let movementsQuery = supabase.from("cash_movements")
      .select("id,movement_type,amount,created_at")
      .eq("org_id", orgId).gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()).limit(1000);
    let customersQuery = supabase.from("customers")
      .select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("active", true);
    let professionalsQuery = supabase.from("professionals")
      .select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("active", true);

    if (state.branch?.id) {
      appointmentsQuery = appointmentsQuery.eq("branch_id", state.branch.id);
      movementsQuery = movementsQuery.eq("branch_id", state.branch.id);
      customersQuery = customersQuery.eq("branch_id", state.branch.id);
      professionalsQuery = professionalsQuery.eq("branch_id", state.branch.id);
    }

    const [appointmentsResult, movementsResult, customersResult, professionalsResult] = await Promise.all([
      appointmentsQuery, movementsQuery, customersQuery, professionalsQuery
    ]);
    for (const result of [appointmentsResult, movementsResult, customersResult, professionalsResult]) {
      if (result.error) throw result.error;
    }

    const movements = movementsResult.data || [];
    const received = movements.filter(item => item.movement_type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const outflow = movements.filter(item => item.movement_type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const appointments = appointmentsResult.data || [];

    host.innerHTML = `
      <section class="metrics">
        <article class="metric-card"><div class="metric-top"><span>Recebimentos hoje</span></div><strong>${money(received)}</strong><small>Entradas registradas no Caixa</small></article>
        <article class="metric-card"><div class="metric-top"><span>Saídas hoje</span></div><strong>${money(outflow)}</strong><small>Saídas registradas no Caixa</small></article>
        <article class="metric-card"><div class="metric-top"><span>Agendamentos hoje</span></div><strong>${appointments.length}</strong><small>Atendimentos listados para hoje</small></article>
        <article class="metric-card"><div class="metric-top"><span>Clientes ativos</span></div><strong>${customersResult.count ?? "—"}</strong><small>Cadastro da unidade selecionada</small></article>
        <article class="metric-card"><div class="metric-top"><span>Profissionais ativos</span></div><strong>${professionalsResult.count ?? "—"}</strong><small>Equipe da unidade selecionada</small></article>
      </section>
      <section class="surface">
        <div class="section-heading"><div><h2>Agenda de hoje</h2><p>Horários e atendimentos cadastrados</p></div><button class="text-action" type="button" data-page="Agenda">Abrir agenda →</button></div>
        <div class="record-list">
          ${appointments.map(item => `
            <article class="record-card">
              <span class="record-main"><b>${esc(item.customer_name || "Cliente")}</b><small>${esc(item.service_name || "Serviço não informado")} · ${esc(item.professional_name || "Profissional não informado")}</small></span>
              <span class="record-trailing"><b>${dateTime(item.starts_at)}</b>${status(item.status || "Agendado")}</span>
            </article>`).join("") || '<div class="empty-state">Nenhum agendamento encontrado para hoje.</div>'}
        </div>
      </section>
      <p class="subtle-note">Indicadores calculados a partir dos registros disponíveis no banco de dados. Valores não representam previsão de faturamento.</p>`;
  } catch (error) {
    reportError(error, { context: "Dashboard > carregar indicadores" });
    host.innerHTML = '<div class="empty-state">Não foi possível carregar os indicadores. Verifique a conexão e as permissões da unidade.</div>';
  }
}
