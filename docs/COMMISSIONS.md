# Regras de Comissões

## Configuração

- Cada profissional pode ter uma comissão padrão.
- Uma regra específica por profissional + serviço prevalece sobre a comissão padrão.
- Exemplo: Corte 50%, Progressiva 40%, Escova 40%.
- Produtos podem ter regra específica ou percentual padrão, conforme a configuração de comissão de produtos.
- O profissional responsável é armazenado no item da Comanda.
- O percentual aplicado fica gravado em cada lançamento para preservar o histórico quando a regra for alterada.

## Cálculo por recebimento

A comissão nasce do valor efetivamente recebido, não apenas do agendamento ou da inclusão do item na Comanda.

- Cada pagamento parcial gera lançamentos proporcionais para os itens elegíveis.
- O pagamento final gera apenas a parcela restante, sem repetir a comissão já lançada nos pagamentos anteriores.
- Cada lançamento é ligado ao item da Comanda e ao recebimento que o originou por `service_order_payment_id`.
- O lançamento registra base, percentual, valor, profissional e status.
- Produtos só geram comissão quando a configuração de comissão de produtos está ativa e há profissional vinculado.

Exemplo: serviço de R$ 200,00 com comissão de 50%. Se o cliente pagar R$ 100,00, são gerados R$ 50,00 de comissão sobre o valor recebido. O saldo gera a comissão restante no próximo pagamento.

## Pagamento ao profissional

- O usuário seleciona lançamentos pendentes de um profissional.
- `pay_professional_commissions` bloqueia e valida os lançamentos.
- O pagamento cria `commission_payouts`, liga os lançamentos e registra uma saída em `cash_movements`.
- É obrigatório haver caixa aberto na unidade correspondente.
- A quitação preserva o histórico e impede pagamento duplicado.

## Cancelamentos e estornos

- Uma Comanda aberta sem pagamentos pode ser cancelada sem estorno.
- Uma Comanda com recebimentos parciais pode ser cancelada por fluxo de estorno integral, com saída no Caixa para cada recebimento original.
- Lançamentos de comissão não pagos são marcados como cancelados; os pagamentos originais permanecem no histórico como estornados.
- Se uma comissão já foi paga, o cancelamento é bloqueado para exigir ajuste financeiro explícito.
- Comandas já quitadas/fechadas não entram no fluxo de cancelamento; devolução de venda fechada exige processo próprio.

## Backend

- `private.accrue_partial_service_order_commissions`: calcula comissão dos pagamentos parciais.
- `register_service_order_payment`: registra pagamento, movimento de caixa, comissão e, na quitação, venda/estoque.
- `pay_professional_commissions`: paga lançamentos pendentes e cria saída no Caixa.
- `cancel_service_order`: cancela a Comanda e estorna os recebimentos parciais.

## Observações de teste

As migrations foram aplicadas e as definições das funções verificadas no banco. Ainda é necessário executar testes operacionais ponta a ponta com uma conta de teste, incluindo múltiplos pagamentos, mudança de regra entre pagamentos, produtos e estornos.
