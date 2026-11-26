# Meta do App Profissional do Salão Premium

Entregar uma área de trabalho móvel em que o profissional opere sua agenda, consulte clientes e serviços autorizados e acompanhe comandas e comissões. Supabase mantém os registros operacionais compartilhados com o painel. Firebase Cloud Messaging entrega notificações aos dispositivos inscritos.

| Entrega | Critério de aceite | Situação |
| --- | --- | --- |
| Login e perfil | Usar a estrutura e o CSS de autenticação do painel, com CPF para profissionais e recuperação pelo admin. Configurações acessíveis no menu de perfil. | Estilos compartilhados no código, menu implementado. Falta validar em navegador. |
| Agenda | Criar, confirmar, reagendar e cancelar pela agenda individual. Validar vínculo de serviço, unidade, conflitos, horário e transição no servidor. A mesma alteração deve aparecer no painel. | Leitura mensal existente. Operações pendentes. |
| Clientes | Consultar somente clientes autorizados ao profissional e apresentar os dados de contato permitidos. | Pendente. |
| Serviços | Mostrar os serviços ativos vinculados, preço e duração. | Implementado. |
| Comandas e comissões | Exercer ações de comanda permitidas e mostrar comissões do próprio profissional. | Telas existentes. Homologação por perfil pendente. |
| Identidade | Compartilhar marca, tokens, controles, temas e estados de interface. Conferir menu e formulários em celular. | CSS e marca compartilhados. Conferência visual pendente. |
| Notificações | Inscrever o dispositivo com consentimento, enviar eventos de agenda pelo FCM, tratar recusa e revogar inscrição ao sair. Homologar entrega em dispositivo compatível. | Pendente de implementação e configuração do projeto Firebase. |

A homologação deve confirmar atualização entre apps, isolamento por organização e unidade, disponibilidade no agendamento e recebimento de notificação em dispositivo real.
