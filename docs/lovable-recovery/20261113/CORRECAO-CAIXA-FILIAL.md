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
