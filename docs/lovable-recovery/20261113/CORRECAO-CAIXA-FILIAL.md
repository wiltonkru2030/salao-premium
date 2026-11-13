# Correção de pagamento de despesas por filial

A função `public.pay_expense(uuid,text,boolean)` seleciona primeiro o caixa aberto da mesma filial da despesa. Se não houver caixa aberto na filial, utiliza o caixa central da mesma organização. Despesas sem filial utilizam somente o caixa central.

A seleção é bloqueada com `FOR UPDATE` durante a transação, e a despesa é marcada como paga somente na mesma transação que registra a saída em `cash_movements`. Uma segunda tentativa encontra o status diferente de `pending` e é recusada. Nenhum movimento financeiro existente é removido ou reescrito.

A função exige autenticação e papel `owner`, `admin`, `manager` ou `finance` na organização proprietária da despesa. O privilégio `EXECUTE` é concedido somente a `authenticated` e `service_role`.

## Cenários de validação
- Despesa da filial com caixa aberto na mesma filial: usa o caixa da filial.
- Despesa da filial sem caixa próprio, mas com caixa central aberto: usa o caixa central.
- Despesa da filial sem nenhum caixa elegível: operação falha sem marcar a despesa como paga.
- Despesa sem filial: usa caixa central.
- Despesa já paga/cancelada: operação recusada, sem duplicar saída.
- `p_use_cash=false`: registra pagamento sem movimento de caixa, conforme opção explícita do fluxo.

## Aplicação e verificação realizadas

- Migration aplicada no Supabase: versão `20261113121938`, nome `fix_expense_payment_branch_cash_register`.
- A versão foi conferida em `supabase_migrations.schema_migrations`.
- A definição instalada foi relida com `pg_get_functiondef` e confirma o filtro por organização, filial correspondente ou caixa central, com preferência à filial.
- Privilégios conferidos no catálogo: `anon` não executa a RPC; `authenticated` pode executá-la e a função valida papel e organização antes de alterar dados.
- Teste SQL isolado da regra de seleção: 4 cenários passaram (filial priorizada, fallback central, ausência de caixa elegível e despesa sem filial). Esse teste valida a regra de seleção, não substitui um teste transacional ponta a ponta com usuários e registros reais.
- CI GitHub no commit anterior à correção do nome do arquivo: workflow `Agenda tests` aprovado e workflow `App validation` aprovado. O App validation executou verificação de sintaxe, build/imports, auditoria estrutural e testes de utilitários, erros PT-BR, orçamentos, comanda, caixa, tenant e agenda.
- Após alinhar o nome do arquivo ao timestamp efetivamente registrado no banco, não há confirmação de uma nova execução de CI no HEAD mais recente.
