/**
 * SALÃO PREMIUM — Visão geral operacional.
 * Responsabilidade: apresentar indicadores e próximos atendimentos consultados no Supabase.
 * Segurança: todas as consultas são limitadas à organização autenticada e continuam sujeitas às políticas RLS.
 */
import { state } from '../state.js';
import { supabase } from '../supabase/client.js';
import { head, btn, metric, initials, status, esc } from '../utils.js';
import { reportError } from '../utils/errors.js';

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
    const [appointmentsResult, customersResult, servicesResult, professionalsResult] = await Promise.all([
      supabase.from('appointments')
        .select('id,customer_name,service_name,professional_name,starts_at,status', { count: 'exact' })
        .eq('org_id', orgId)
        .gte('starts_at', now.toISOString())
        .lt('starts_at', dayEnd.toISOString())
        .not('status', 'in', '(cancelled,no_show)')
        .order('starts_at')
        .limit(4),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true)
    ]);

    for (const result of [appointmentsResult, customersResult, servicesResult, professionalsResult]) {
      if (result.error) throw result.error;
    }

    const appointments = appointmentsResult.data || [];
    const appointmentCount = appointmentsResult.count ?? appointments.length;
    const cards = '<div class="metrics">' +
      metric('Atendimentos restantes', String(appointmentCount), 'a partir de agora', 'hoje, sem cancelamentos ou faltas') +
      metric('Clientes ativos', String(customersResult.count ?? 0), 'cadastros ativos', 'na organização') +
      metric('Serviços ativos', String(servicesResult.count ?? 0), 'serviços disponíveis', 'na organização') +
      metric('Profissionais ativos', String(professionalsResult.count ?? 0), 'equipe ativa', 'na organização') +
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

    host.innerHTML = cards +
      '<div class="dashboard-grid"><section class="surface">' +
      '<div class="section-heading"><div><h2>Próximos atendimentos</h2><p>' +
      esc(now.toLocaleDateString('pt-BR', { dateStyle: 'full' })) +
      '</p></div><button class="text-action" data-page="Agenda">Ver agenda →</button></div>' +
      appointmentRows + '</section></div>' +
      '<p class="demo-note">Indicadores consultados diretamente no banco de dados da organização ativa.</p>';
  } catch (error) {
    const diagnostic = reportError(error, { context: 'Dashboard > carregar indicadores', notify: false });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar o painel.</b>' +
      '<small>Verifique sua conexão e suas permissões. Código ' + esc(diagnostic.id) + '</small></div>';
  }
}
