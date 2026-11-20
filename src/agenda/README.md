# Módulo Agenda — SALÃO PREMIUM

## Estrutura
- pages/agenda-page.js: consulta profissionais e bloqueios, usa o repositório Supabase para agendamentos e compõe o calendário.
- components/: seletor de profissional, toolbar, calendários Dia/Semana/Mês, slots, cards, drawer, formulários e filtros.
- controllers/: eventos, gravações e ações de atendimento.
- hooks/: adaptadores assíncronos que exigem cliente Supabase e organização ativa.
- services/agenda.service.js: repositório Supabase assíncrono, com escopo obrigatório por org_id, paginação, leitura, criação, atualização e status.
- services/availability.service.js: validações locais auxiliares; não substituem triggers e validações do banco.
- utils/: datas, duração e conflitos.
- styles/agenda.css: layout específico do calendário; tokens e componentes globais ficam em src/styles/design-system.css.
- tests/: testes de regras, repositório com cliente Supabase simulado e renderização.

## Fluxo conectado ao banco
1. src/app.js recebe ações globais e executa criação, edição, confirmação, chegada, cancelamento e bloqueios.
2. agenda-page.js consulta profissionais e bloqueios do Supabase e usa agenda.service.js para ler agendamentos paginados.
3. O banco valida conflitos de horário e compatibilidade profissional/serviço por triggers.
4. Ao abrir um atendimento agrupado, start_appointment_group_service_order chama a abertura dos serviços dentro de uma única transação. Se qualquer serviço falhar, todo o grupo é revertido.
5. A Comanda mantém o vínculo de cada item com o agendamento de origem.

## Funcionalidades
- Visões Dia, Semana e Mês, navegação de período e Hoje.
- Filtro por profissional, busca e status.
- Leitura de agendamentos e bloqueios persistidos.
- Criar, editar, confirmar, registrar chegada, cancelar e excluir agendamentos.
- Abrir ou reutilizar Comanda a partir da chegada.
- Criar e remover bloqueios de horário.
- Validação de conflito e de profissional/serviço no backend.
- Consultas do repositório limitadas ao tenant e paginadas; UUIDs de profissionais são aceitos no validador.

## Segurança e manutenção
- As consultas são limitadas à organização ativa e sujeitas a RLS.
- A interface não substitui os triggers de integridade e as RPCs.
- Os fluxos de data usam horário local no navegador e timestamptz no banco; alterações devem preservar esse contrato.
- Não há dados operacionais de demonstração no repositório da Agenda.
- Os dados simulados dos testes existem somente em fixtures isoladas e nunca são usados pela aplicação.

## Testes e limitações
Os testes automatizados da Agenda e o build são executados pelo GitHub Actions. Ainda falta validar visualmente o calendário em navegador e testar com registros reais controlados: conflito concorrente, reagendamento, bloqueios, atendimento agrupado e sincronização com Comanda.
