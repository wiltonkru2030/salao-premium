# Módulo Agenda — SALÃO PREMIUM

## Estrutura
- `pages/agenda-page.js`: consulta dados do Supabase, adapta registros e compõe o calendário.
- `components/`: seletor de profissional, toolbar, calendários Dia/Semana/Mês, slots, cards, drawer, formulários e filtros.
- `hooks/`: adaptadores simples de estado/consulta; não são React hooks.
- `services/agenda.service.js`: repositório legado em memória; não é a fonte de persistência do fluxo administrativo.
- `services/availability.service.js`: validações locais auxiliares.
- `utils/`: datas, duração e conflitos.
- `styles/agenda.css`: layout específico do calendário; tokens e componentes globais ficam em `src/styles/design-system.css`.
- `tests/`: testes automatizados de regras, serviços e renderização.

## Fluxo conectado ao banco
1. `src/app.js` recebe ações globais e executa criação, edição, confirmação, chegada, cancelamento e bloqueios.
2. `src/agenda/pages/agenda-page.js` consulta profissionais, agendamentos e bloqueios do Supabase.
3. O banco valida conflitos de horário e compatibilidade profissional/serviço por triggers.
4. Ao abrir um atendimento agrupado, `start_appointment_group_service_order` chama a abertura dos serviços dentro de uma única transação. Se qualquer serviço falhar, todo o grupo é revertido.
5. A Comanda mantém o vínculo de cada item com o agendamento de origem.

## Funcionalidades
- Visões Dia, Semana e Mês, navegação de período e Hoje.
- Filtro por profissional, busca e status.
- Leitura de agendamentos e bloqueios persistidos.
- Criar, editar, confirmar, registrar chegada, cancelar e excluir agendamentos.
- Abrir ou reutilizar Comanda a partir da chegada.
- Criar e remover bloqueios de horário.
- Validação de conflito e de profissional/serviço no backend.

## Segurança e manutenção
- As consultas são limitadas à organização ativa e sujeitas a RLS.
- A interface não substitui os triggers de integridade e as RPCs.
- Os fluxos de data usam horário local no navegador e timestamptz no banco; alterações devem preservar esse contrato.
- O repositório em memória e os adaptadores legados não devem ser confundidos com o fluxo administrativo Supabase.

## Testes e limitações
Os testes automatizados da Agenda e o build são executados pelo GitHub Actions. Ainda falta validar visualmente o calendário em navegador e testar com registros reais controlados: conflito concorrente, reagendamento, bloqueios, atendimento agrupado e sincronização com Comanda.
