# Módulo Agenda — SALÃO PREMIUM

## Estrutura do módulo
- `pages/agenda-page.js`: consulta o Supabase, adapta os registros e compõe a tela do calendário.
- `components/`: seletor de profissional, toolbar, calendários Dia/Semana/Mês, slots, cards, drawer, formulários e filtros.
- `hooks/`: adaptadores simples de estado e consulta; não são React hooks.
- `services/agenda.service.js`: repositório local legado em memória. Não é a fonte de persistência do fluxo administrativo atual.
- `services/availability.service.js`: validações locais de disponibilidade.
- `utils/`: datas, duração e conflitos.
- `styles/agenda.css`: estilos específicos; identidade e tokens globais ficam em `src/styles/`.
- `tests/`: testes automatizados de regras, serviços e renderização.

## Fluxo administrativo atual
1. `src/app.js` recebe ações globais da interface e executa operações de agendamento/bloqueio.
2. `src/agenda/pages/agenda-page.js` consulta profissionais, agendamentos e bloqueios no Supabase.
3. `src/agenda/components/` desenha o calendário e os formulários.
4. `src/supabase/client.js` fornece a conexão autenticada; as consultas filtram a organização ativa.
5. A validação visual no navegador não substitui regras, autorização, RLS e integridade no banco.

## Funcionalidades implementadas no fluxo administrativo
- Alternância Dia, Semana e Mês; navegação de período e botão Hoje.
- Filtro por profissional, busca e status.
- Leitura de agendamentos e bloqueios persistidos no Supabase.
- Criar, editar, confirmar, registrar chegada, cancelar e excluir agendamentos.
- Abrir comanda a partir da chegada do cliente.
- Criar e remover bloqueios de horário.
- Verificação de conflitos antes de criar bloqueios e validações de formulário.
- Testes automatizados de regras e regressões da Agenda.

## Código legado / cuidado
`services/agenda.service.js` e os adaptadores `hooks/` mantêm um repositório demonstrativo em memória. Eles não devem ser confundidos com o fluxo administrativo conectado ao Supabase. Antes de reutilizar ou remover esse código, verificar referências e testes.

## Limitações a validar
- As regras de disponibilidade e conflitos precisam ser garantidas no servidor, não apenas no navegador.
- Validar fuso horário, expediente, folgas, buffers, recursos, serviços compatíveis e concorrência no backend.
- Confirmar RLS e escopo de organização para cada consulta e mutação.
- Criar testes de integração para criação concorrente, reagendamento e sincronização com comandas.
