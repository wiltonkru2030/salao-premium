# Módulo Agenda — SALÃO PREMIUM

## Organização
- `pages/agenda-page.js`: composição da tela.
- `components/`: seletor de profissional, toolbar, calendários Dia/Semana/Mês, slots, cards, drawer, formulários e filtros.
- `hooks/`: adaptadores de consulta para a interface JavaScript atual; não são React hooks.
- `services/`: repositório temporário em memória e validação de disponibilidade.
- `utils/`: datas, duração e conflitos.
- `styles/agenda.css`: estilos específicos; tokens e identidade global permanecem centralizados em `src/styles`.
- `tests/`: verificações unitárias exportadas.

## Funcionalidades locais
- Alternância Dia, Semana e Mês; navegação de período e botão Hoje.
- Filtro por profissional, busca por cliente/serviço/telefone e filtro por status.
- Criar e editar agendamentos na memória da sessão.
- Alterar status, abrir detalhes e mover cartões no calendário desktop.
- Bloquear períodos, impedir sobreposição com atendimentos e outros bloqueios, e remover bloqueios.
- Validação de campos, duração, expediente (08:00–20:00) e conflitos de profissional.
- Layout adaptável para celular e desktop.

## Contrato para integração futura
A interface deve continuar chamando `agendaRepository` em `services/agenda.service.js`. Na integração, trocar a implementação local por chamadas HTTP mantendo os formatos de retorno. O servidor deverá repetir validações e aplicar autorização, tenant/unidade, concorrência e transações antes de persistir.

## Limites importantes
Os dados atuais vêm de `src/data/index.js` e são demonstrativos. Agendamentos e bloqueios são mantidos somente na memória do navegador e desaparecem ao recarregar. Não há API, banco, autenticação, permissões reais, auditoria, notificações, sincronização em tempo real ou garantia operacional. O motor local é apenas uma pré-validação de interface. Expediente, folgas, buffers, serviços compatíveis, recursos físicos, fusos e políticas precisam ser configurados no backend.
