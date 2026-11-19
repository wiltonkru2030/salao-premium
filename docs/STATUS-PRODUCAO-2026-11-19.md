# Status de prontidão — 19/11/2026

## Resultado executivo

**Não liberar para produção ou venda ainda.** O HEAD atual `7d969a019a034ff0123db569af244927046942c5` passou pelas etapas de sintaxe, build/importações e testes unitários nos workflows consultados. A auditoria ainda identifica funcionalidades demonstrativas, documentação incompleta e validações reais pendentes.

## Validação automatizada

Commit de referência da suíte completa: `91e7d699820d4e8ea14fe4c39da4c99d3efd6616`. HEAD mais recente verificado em 19/11/2026: `7d969a019a034ff0123db569af244927046942c5`.

- Sintaxe de todos os arquivos JavaScript: aprovada.
- Build de produção e importações: aprovado.
- Testes de utilitários, tratamento de erros, Orçamentos, Comanda, Caixa, tenant e Agenda: aprovados.
- Comando agregado `npm run test:all`: aprovado.
- Workflows `App validation` e `Agenda tests`: concluídos com sucesso no commit de referência.
- No HEAD `7d969a019a034ff0123db569af244927046942c5`, o workflow [App validation](https://github.com/wiltonkru2030/salao-premium/actions/runs/44564188918) concluiu sintaxe, build/importações e todos os passos de testes com sucesso; o job ainda estava finalizando quando consultado. O workflow [Agenda tests](https://github.com/wiltonkru2030/salao-premium/actions/runs/44564188931) concluiu com sucesso.
- Após a auditoria inicial, o Dashboard deixou de usar métricas fictícias e passou a consultar atendimentos futuros do dia e contagens de clientes, serviços e profissionais ativos no Supabase, sempre filtrando a organização ativa. Os campos utilizados foram conferidos no schema atual. Essa alteração ainda não equivale a um teste E2E autenticado.

Esses testes não substituem testes E2E, integração com usuários de teste e validação visual em dispositivos reais.

## Documentação do código

A auditoria estática percorreu 107 arquivos (79 JS/MJS) e encontrou 137 declarações exportadas analisáveis:
- 102 com JSDoc;
- 35 ainda sem JSDoc;
- 48 apontamentos estruturais totais, incluindo funções sem documentação, arquivos grandes e linhas extensas.

O verificador ainda é informativo: o CI não falha quando existem apontamentos. Portanto, a documentação não pode ser considerada completa.

## Funcionalidades demonstrativas encontradas

- `src/pages/dashboard.js`: foi conectado ao Supabase no commit `7e2fea4` e ajustado no `cddecb4`; falta validar o fluxo com sessão real e dados de QA.
- `src/pages/records.js`: lista registros locais da estrutura `src/data/index.js`, sem persistência real.
- `src/pages/settings.js`: declara que as preferências são demonstrativas e não persistem no Supabase.
- `src/agenda/services/agenda.service.js`: repositório local em memória, descrito no próprio módulo como legado/demonstrativo.
- `src/pages/branches.js`: substituído o mock por listagem e cadastro de unidades via Supabase, com ativação/inativação para owner/admin e filtro por organização; precisa de teste E2E com perfis distintos.
- Páginas `finance`, `reports` e `sales` ainda reutilizam a listagem genérica de `records.js`; não devem ser tratadas como módulos financeiro/comercial concluídos sem substituir essa fonte.

Esses módulos precisam ser conectados a operações reais, com RLS/RPC quando aplicável, e cobertos por testes. Não basta remover os rótulos demonstrativos.

## Tratamento de erros

O tradutor central foi ampliado para erros PostgreSQL, HTTP 408/429/5xx, autenticação, falhas de rede e mensagens seguras em português. Os testes ampliados passaram no CI.

Ainda falta verificar todos os fluxos de I/O e confirmar que cada tela oferece recuperação adequada, sem operações silenciosamente ignoradas ou estados de carregamento presos.

## Revisão de segurança Supabase — 19/11/2026

- O Security Advisor reportou 16 funções `SECURITY DEFINER` públicas executáveis por `authenticated`. A consulta de privilégios confirmou que nenhuma dessas funções aceita execução pelo papel `anon`.
- A inspeção estática das definições mostrou validação de organização/papel nas 16 funções; 15 incluem verificação explícita de `auth.uid()`. A função de início de grupo de atendimentos valida o papel e o escopo profissional, mas merece teste dedicado com sessão anônima/autenticada antes da liberação.
- As funções verificadas usam `search_path = ''`, reduzindo risco de resolução insegura de objetos.
- O alerta do Advisor, portanto, não comprova acesso anônimo indevido; ainda assim, cada RPC deve ser validada com contas de QA e casos negativos por organização antes de reduzir privilégios ou alterar `SECURITY DEFINER`.
- A proteção contra senhas vazadas permanece desativada no Supabase Auth e precisa ser habilitada nas configurações do projeto.

## Pendências para liberação

1. Documentar as 35 funções exportadas restantes e revisar a qualidade semântica dos comentários.
2. Substituir as fontes demonstrativas/localmente simuladas por fluxos reais persistidos, sem criar dados fictícios no ambiente de produção.
3. Testar E2E Dashboard, Agenda, Comanda, Caixa, Orçamentos, cadastros e App Profissional.
4. Validar isolamento entre duas organizações e entre matriz/filial com contas de QA independentes.
5. Concluir a revisão das permissões/RLS e alertas do Security Advisor, incluindo proteção contra senhas vazadas.
6. Validar visual e responsividade em desktop e celular.
7. Confirmar restauração, auditoria, pagamentos parciais, estornos, estoque e comissões em ambiente isolado.

## Estado Git

A branch de recuperação permanece separada de `main`; a PR #1 está aberta em draft e não foi mesclada. Não houve deploy de produção nesta rodada.


## Atualização — módulo Financeiro
- Implementado painel Financeiro de consulta, conectado ao Supabase e ao carregador da rota.
- Entradas e saídas do caixa são consultadas em `cash_movements`, filtradas por `org_id` e pelo mês atual.
- Despesas cadastradas são consultadas separadamente em `expenses`; despesas pendentes não são somadas às saídas efetivas do caixa.
- Consultas limitadas a 500 registros por conjunto. Não há criação, edição, baixa ou estorno nesta tela.
- Restrições confirmadas no banco: `cash_movements.movement_type` aceita somente `income` e `expense`; despesas aceitam `pending`, `paid` e `cancelled`.
- Validação de código: import e carregador da rota conferidos no commit `ac72445d9d150fcaea4987fc2dd5087194e8418f`. Nenhuma execução de CI foi retornada para esse commit até a última consulta; build, testes automatizados e E2E permanecem pendentes de confirmação.
- Não houve alteração de schema, dados financeiros, permissões, branch principal ou deploy.


## Atualização — módulo Despesas
- Criado `src/pages/expenses.js` com listagem Supabase filtrada por organização, indicadores de pendências e cadastro de despesas com validação de valor e descrição.
- A baixa utiliza a RPC `pay_expense`, que bloqueia a despesa, valida o perfil e registra a saída no caixa na mesma transação quando solicitado. Não há inserção manual paralela em `cash_movements`.
- Cancelamento utiliza a RPC `cancel_expense`; a função do banco só permite cancelar despesas pendentes.
- Schema confirmado: status aceitos `pending`, `paid`, `cancelled`; valores devem ser positivos. RLS de leitura/cadastro/alteração limita a owner, admin, manager e finance; a política de exclusão também permite manager, mas a tela não oferece exclusão.
- Adicionado item Despesas ao menu Financeiro e conectado à página/carregador no compositor.
- Commit de código: `c9363f7de84e8063f507f6d23d9e0432ca1bbf0b`. Conferidos import, rota, carregador e navegação.
- CI para o commit de código `c9363f7de84e8063f507f6d23d9e0432ca1bbf0b`: App validation (run `44567044249`) e Agenda tests (run `44567044545`) concluídos com sucesso. A validação inclui sintaxe de todos os JavaScript, build/importações, auditoria estrutural e testes agregados existentes. Isso não substitui E2E autenticado das novas ações de Despesas.
- Não houve alteração de schema, dados, permissões, branch principal ou deploy. Ainda falta E2E autenticado para cadastrar, pagar com/sem caixa, cancelar, testar perfis e validar isolamento por organização.

## Atualização — fluxo de pagamento de despesas
- A tela Despesas já possuía cadastro, cancelamento e integração com as RPCs transacionais; nesta etapa, o pagamento deixou de usar caixas de prompt e confirmação para escolher a forma de pagamento.
- Adicionado modal de pagamento com forma de pagamento explícita e opção de registrar a saída no caixa. A confirmação chama exclusivamente `pay_expense`; não há inserção manual de `cash_movements` no cliente.
- Cancelamento continua usando `cancel_expense`, restrito pelo banco a despesas pendentes. As RPCs `pay_expense` e `cancel_expense` foram verificadas com EXECUTE para `authenticated` e sem EXECUTE para `anon`.
- Não foi executado pagamento ou cancelamento real nem alterado dado financeiro. Build/CI e teste autenticado seguem pendentes de confirmação.


## Atualização — auditoria do módulo Comissões
- A página `src/pages/commissions.js` já consulta lançamentos, profissionais, regras, pagamentos e referências de itens/recebimentos da Comanda, sempre filtrando a organização ativa.
- Corrigida a mensagem vazia da tela: comissões podem ser geradas proporcionalmente durante pagamentos parciais, não apenas quando a Comanda é quitada. Também foi consolidada a documentação JSDoc do carregador.
- Banco conferido: RLS está habilitado em `commissions`, `commission_rules`, `commission_payouts`, `commission_payout_items` e `app_settings`. As políticas de leitura das comissões limitam a administração/financeiro aos papéis autorizados e o profissional aos próprios lançamentos.
- A RPC `register_service_order_payment` distribui a base da comissão entre recebimentos parciais e conclui o saldo no pagamento final. A RPC `pay_professional_commissions` valida usuário, organização, profissional, seleção e status, bloqueia duplicidade e grava pagamento + saída no Caixa na mesma transação.
- A RPC `refund_service_order` cancela comissões pendentes/aprovadas e bloqueia devolução automática quando já há comissão paga, exigindo ajuste financeiro com o profissional.
- O teste de integração `tests/integration/backend-flows.test.mjs` contém cenários para comissão proporcional, pagamento duplicado, cancelamento com estorno e isolamento entre organizações. Esse teste exige credenciais de QA e **não foi executado nesta etapa**.
- CI do HEAD anterior `a109fe9a9d3b64af550c8545c19255d9461a2c0a`: App validation (run `44577505988`) e Agenda tests (run `44577506011`) concluídos com sucesso. Após a pequena correção de texto/documentação desta etapa, os workflows precisam ser repetidos no novo commit.
- Não houve alteração de schema, permissões, dados financeiros, branch principal ou deploy. O módulo foi auditado e recebeu correção de documentação/clareza; o E2E autenticado com contas QA permanece pendente.


## Atualização — módulo Relatórios
- Substituída a página genérica baseada em `records.js` por um relatório mensal somente leitura, consultando `service_order_payments`, `cash_movements`, `service_orders`, `appointments` e `commissions` do Supabase, sempre com filtro `org_id`.
- Indicadores apresentados: recebimentos confirmados, ticket médio das comandas fechadas, atendimentos concluídos, comandas em aberto, entradas/saídas do Caixa, resultado dos movimentos, comissões geradas/pagas e distribuição dos atendimentos por status.
- Mantidos conceitos separados: recebimentos não são somados novamente às entradas do Caixa; estornos de recebimentos aparecem como saídas quando registrados no Caixa. Comissões geradas usam `created_at`; comissões pagas são consultadas separadamente por `paid_at`, incluindo lançamentos criados em meses anteriores.
- Filtro mensal sem reload da aplicação. Proteção de interface para owner/admin/manager, alinhada às políticas de leitura de Comandas e Agenda; RLS permanece a proteção efetiva no banco. Consultas limitadas a 2.000 registros por conjunto, limite informado na própria tela.
- O módulo não grava dados nem cria métricas estimadas. Ainda requer validação E2E com sessão autenticada, dados de QA e comparação com extratos do Caixa; não foi executado teste visual nem relatório para grandes volumes.
- Não houve alteração de schema, permissões, dados financeiros, branch principal ou deploy.
