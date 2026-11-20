/**
 * SALÃO PREMIUM — Visão geral operacional.
 * Responsabilidade: apresentar indicadores e próximos atendimentos consultados no Supabase.
 * Segurança: todas as consultas são limitadas à organização autenticada e continuam sujeitas às políticas RLS.
 */
import { state } from '../state.js';
import { supabase } from '../supabase/client.js';
import { head, btn, initials, status, esc } from '../utils.js';
import { reportError } from '../utils/errors.js';

/** Evita sobrescrever uma rota ou organização diferente após consultas assíncronas. */
function dashboardIsCurrent(host, orgId) {
  return host.isConnected && state.page === 'Dashboard' && state.organization?.id === orgId;
}

/** Cartão de indicador sem setas de crescimento inventadas. */
function indicator(label, value, detail, icon) {
  return '<article class="sp-overview-card"><div class="sp-overview-card-top"><span>' + esc(label) +
    '</span><span class="sp-overview-card-icon" aria-hidden="true">' + icon + '</span></div>' +
    '<strong>' + esc(value) + '</strong><small>' + esc(detail) + '</small></article>';
}

/** Formata uma data ISO para horário local sem alterar o valor persistido. */
function formatTime(value) {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Converte estados internos de atendimento em rótulos compreensíveis na interface. */
function appointmentStatus(value) {
  return ({
    scheduled: 'Aguardando',
    confirmed: 'Confirmado',
    arrived: 'Cliente chegou',
    in_progress: 'Em atendimento',
    completed: 'Finalizado',
    cancelled: 'Cancelado',
    no_show: 'Falta'
  })[value] || value || 'Sem status';
}

/** Renderiza a estrutura inicial enquanto os indicadores reais são consultados. */
export function dashboard() {
  return head('Visão geral', 'Acompanhe os principais números e os próximos atendimentos do seu salão.', btn('＋ Novo agendamento', 'new-appointment', 'primary')) +
    '<div id="dashboard-db-content"><div class="empty-state">Carregando indicadores do salão…</div></div>';
}

/**
 * Consulta indicadores operacionais e atendimentos do dia para a organização ativa.
 * @returns {Promise<void>} Atualiza o painel com dados retornados pelo Supabase.
 * @throws {Error} Erros de consulta são tratados e apresentados em português na própria tela.
 */
export async function loadDashboard() {
  const host = document.querySelector('#dashboard-db-content');
  if (!host || !state.user || !state.organization?.id) return;

  const orgId = state.organization.id;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  host.innerHTML = '<div class="empty-state">Carregando indicadores do salão…</div>';

  try {
    const [appointmentsResult, todayResult, customersResult, servicesResult, professionalsResult] = await Promise.all([
      supabase.from('appointments')
        .select('id,customer_name,service_name,professional_name,starts_at,status', { count: 'exact' })
        .eq('org_id', orgId)
        .gte('starts_at', now.toISOString())
        .lt('starts_at', dayEnd.toISOString())
        .not('status', 'in', '(cancelled,no_show)')
        .order('starts_at')
        .limit(6),
      supabase.from('appointments').select('id', { count: 'exact', head: true })
        .eq('org_id', orgId).gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString())
        .not('status', 'in', '(cancelled,no_show)'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true)
    ]);

    if (!dashboardIsCurrent(host, orgId)) return;
    for (const result of [appointmentsResult, todayResult, customersResult, servicesResult, professionalsResult]) {
      if (result.error) throw result.error;
    }

    const appointments = appointmentsResult.data || [];
    const appointmentCount = appointmentsResult.count ?? appointments.length;
    const cards = '<div class="sp-overview-metrics">' +
      indicator('Atendimentos de hoje', String(todayResult.count ?? 0), 'Programados, incluindo os já realizados', '◷') +
      indicator('Restantes hoje', String(appointmentCount), 'A partir de agora', '▦') +
      indicator('Clientes ativos', String(customersResult.count ?? 0), 'Cadastros na organização', '♙') +
      indicator('Profissionais ativos', String(professionalsResult.count ?? 0), 'Equipe disponível no cadastro', '♧') +
      '</div>';

    const appointmentRows = appointments.length
      ? appointments.map(item => '<div class="appointment-preview">' +
        '<time>' + esc(formatTime(item.starts_at)) + '</time>' +
        '<span class="avatar small">' + esc(initials(item.customer_name || '?')) + '</span>' +
        '<span class="preview-info"><b>' + esc(item.customer_name || 'Cliente não informado') + '</b>' +
        '<small>' + esc(item.service_name || 'Serviço não informado') +
        (item.professional_name ? ' · ' + esc(item.professional_name) : '') + '</small></span>' +
        status(appointmentStatus(item.status)) + '</div>').join('')
      : '<div class="empty-state">Nenhum atendimento previsto para hoje.</div>';

    host.innerHTML = '<div class="sp-overview-intro"><div><span class="sp-overview-kicker">PAINEL OPERACIONAL</span><h2>Seu salão, em um só lugar.</h2><p>Resumo de ' + esc(now.toLocaleDateString('pt-BR', { dateStyle: 'full' })) + '</p></div><span class="sp-overview-live">Dados da organização ativa</span></div>' + cards +
      '<div class="sp-overview-sections"><section class="surface sp-overview-appointments">' +
      '<div class="section-heading"><div><h2>Próximos atendimentos</h2><p>' +
      esc(now.toLocaleDateString('pt-BR', { dateStyle: 'full' })) +
      '</p></div><button type="button" class="text-action" data-page="Agenda">Ver agenda →</button></div>' +
      appointmentRows + '</section><aside class="surface sp-overview-side"><h2>Catálogo ativo</h2><p>Serviços disponíveis para os atendimentos.</p><strong>' + esc(String(servicesResult.count ?? 0)) + '</strong><small>serviços cadastrados e ativos</small><div class="sp-overview-tip">Os números refletem os cadastros e agendamentos reais da organização.</div></aside></div>';
  } catch (error) {
    if (!dashboardIsCurrent(host, orgId)) return;
    const diagnostic = reportError(error, { context: 'Dashboard > carregar indicadores', notify: false });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar o painel.</b>' +
      '<small>Verifique sua conexão e suas permissões. Código ' + esc(diagnostic.id) + '</small></div>';
  }
}
