/**
 * Tela de agendamentos.
 * Responsabilidade: apresentar o estado real da integração, sem criar reservas fictícias.
 */
export function renderAppointmentsView() {
  return '<section class="page-content"><div class="page-heading"><span class="eyebrow">SUA ROTINA</span><h1>Agendamentos</h1><p>Seus próximos horários e seu histórico ficarão reunidos aqui.</p></div>' +
    '<div class="empty-state"><span class="empty-icon">▣</span><h3>Agendamentos em preparação</h3><p>Ainda não há conexão com o serviço de reservas. Nenhum horário será exibido como confirmado antes da validação no banco.</p></div></section>';
}
