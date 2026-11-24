# Regras de Comissões

> Revisão documental: 24/11/2026. Evidências do código e inventário de 20/11; não houve nova consulta ao banco ou execução de testes nesta revisão. Consulte o README mestre.

## Configuração

- Cada profissional pode ter uma comissão padrão.
- Uma regra específica por profissional + serviço prevalece sobre a comissão padrão.
- Exemplo: Corte 50%, Progressiva 40%, Escova 40%.
- Produtos podem ter regra específica ou percentual padrão, conforme a configuração de comissão de produtos.
- O profissional responsável é armazenado no item da Comanda.
- O percentual aplicado fica gravado em cada lançamento. Para manter a mesma taxa em todos os pagamentos parciais de um item, a migration de snapshot precisa estar aplicada.

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

## Histórico de implementação e limites atuais

- As migrations de regras de comissão por produto, recebimentos parciais e unicidade de regras específicas constam no histórico do banco.
- O SQL de snapshot 20261119170000 foi arquivado em docs/sql/legacy-unapplied/ conforme o guia de migrations; não consta no inventário de 20/11 e não deve ser reaplicado automaticamente. Até sua aplicação em ambiente de teste e posterior autorização, alterar uma regra entre pagamentos parciais pode produzir lançamentos com percentuais diferentes para o mesmo item.
- Os rascunhos de reversão não comprovam estorno de comissão paga ou compensação em repasse futuro; verificar o contrato efetivamente implantado e homologar antes de liberar.
- Faixas progressivas por período/meta não estão implementadas. Regras por profissional e serviço, como Corte 50% e Progressiva 40%, são suportadas.

## Testes pendentes

Executar em ambiente de teste, com dados descartáveis: múltiplos pagamentos, alteração de regra entre parcelas, inclusão de item após primeiro pagamento, comissão de produto ativada/desativada, repasse parcial, estorno de comanda com comissão pendente e já paga, e concorrência entre repasse e devolução.

A migration 20261120211409 valida pagamento em centavos e contém lógica de comissão; não prova snapshot completo ou compensação de estornos. Conferir regra por serviço/produto, parcelas e mudanças de taxa em QA. Usar test:admin-commissions, test:admin-commission-rules, test:commission-payout-summary e test:sql-payment-centavos via npm run. Ver [guia de migrations](MIGRATIONS.md).
