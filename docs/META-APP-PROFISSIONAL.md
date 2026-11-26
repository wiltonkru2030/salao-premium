# Meta do App Profissional do Salão Premium

Entregar uma área de trabalho móvel em que o profissional opere sua agenda, consulte clientes e serviços autorizados e acompanhe comandas e comissões. Supabase mantém os registros operacionais compartilhados com o painel. Firebase Cloud Messaging entrega notificações aos dispositivos inscritos.

| Entrega | Critério de aceite | Situação |
| --- | --- | --- |
| Login e perfil | Usar a estrutura e o CSS de autenticação do painel, com CPF para profissionais e recuperação pelo admin. Configurações acessíveis no menu de perfil. | Estilos compartilhados no código, menu implementado. Falta validar em navegador. |
| Agenda | Criar, confirmar, reagendar e cancelar pela agenda individual. Validar vínculo de serviço, unidade, conflitos, horário e transição no servidor. A mesma alteração deve aparecer no painel. | Leitura mensal existente. Operações pendentes. |
| Clientes | Consultar somente clientes autorizados ao profissional e apresentar os dados de contato permitidos. | Lista de clientes dos próprios agendamentos no mês selecionado, disponível no menu Perfil. Falta homologar em navegador autenticado. |
| Serviços | Mostrar os serviços ativos vinculados, preço e duração. | Implementado. |
| Comandas e comissões | Exercer ações de comanda permitidas e mostrar comissões do próprio profissional. | Telas existentes. Homologação por perfil pendente. |
| Identidade | Compartilhar marca, tokens, controles, temas e estados de interface. Conferir menu e formulários em celular. | CSS e marca compartilhados. Conferência visual pendente. |
| Notificações | Inscrever o dispositivo com consentimento, enviar eventos de agenda pelo FCM, tratar recusa e revogar inscrição ao sair. Homologar entrega em dispositivo compatível. | Pendente de implementação e configuração do projeto Firebase. |

A homologação deve confirmar atualização entre apps, isolamento por organização e unidade, disponibilidade no agendamento e recebimento de notificação em dispositivo real.

Confirmação e cancelamento de agendamentos individuais foram verificados no Supabase de QA com transação revertida. A alteração de agendamento de outro profissional foi recusada. A migration `20261126223517_professional_own_appointment_status.sql` deve estar presente no ambiente antes de compilar com `VITE_PROFESSIONAL_APPOINTMENT_STATUS=true`. Agendamentos agrupados ou com comanda vinculada ficam fora desse fluxo. Criação, remarcação e testes em navegador permanecem pendentes.

O reagendamento individual foi implementado. Em QA, uma transação revertida verificou conversão no fuso America/Manaus, preservação da duração, rejeição de conflito e de uma tentativa feita com horário anterior desatualizado. Para habilitar a interface, aplicar a migration `20261126224857_professional_reschedule_own_appointment.sql` no ambiente correspondente e compilar com `VITE_PROFESSIONAL_RESCHEDULE=true`. A criação de agendamentos e a revisão em navegador continuam pendentes.
