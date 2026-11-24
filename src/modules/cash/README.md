# Módulo Caixa

Consulta e ações: `src/pages/cash.js`; apresentação do painel: `components/cash-dashboard.js`; abertura, fechamento e resumo via `services/cash-operations.js`. O componente recebe dados já carregados e não acessa Supabase.

Responsabilidades: abertura, movimentos, conferência e fechamento. Cada movimento financeiro precisa de referência à origem e não pode ser apagado para corrigir saldo.

Dados: `cash_registers`, `cash_movements`, `service_order_payments`, `service_orders`, `commission_payouts`.

## Regras operacionais

- Escopo por `org_id` e `branch_id`; a interface permite selecionar o Caixa central ou uma filial.
- Filiais inativas permanecem visíveis para conciliação e fechamento de caixas existentes, mas não aceitam novas aberturas.
- A abertura por filial usa `open_cash_register_for_branch`; o banco valida organização, unidade ativa e papel, bloqueia a linha da filial para impedir duas aberturas simultâneas e mantém a RPC antiga para o Caixa central.
- `get_cash_register_summary` calcula entradas e saídas em dinheiro físico para o saldo de gaveta.
- O fechamento calcula o esperado usando somente movimentos com forma de pagamento `cash`. PIX, cartões, transferências e vouchers não compõem o dinheiro contado.
- Pagamentos de Comanda e pagamentos de comissão continuam vinculados ao caixa da unidade, com fallback para o caixa central quando previsto pelas RPCs financeiras.
- As operações críticas são transacionais; o caixa é bloqueado durante recebimentos, pagamentos de comissão, estornos e fechamento.

## Testes e limites

- `npm run test:cash`: contratos de serviços e apresentação com Supabase simulado.
- `npm run test:sql-cash-register`: contrato estático da migration.
- Os testes estáticos não substituem E2E autenticado, teste de concorrência nem conciliação de caixa com dados QA.

## Revisão 24/11/2026 — requisitos adicionais

- Validar caixa aberto correto antes de receber, estornar, pagar comissão ou despesa. Não presumir fallback central quando não autorizado pela RPC.
- Separar dinheiro contado de total por meio de pagamento e conferir diferenças no fechamento. Preservar vínculo com comanda, venda, comissão, despesa e unidade.
- Entrada/saída manual, reembolso e ajuste de saldo precisam de autorização e histórico; jamais excluir movimento para corrigir valor.
- Testes complementares via npm run: test:sql-payment-centavos, test:expenses-service, test:finance-service, test:commission-payout-summary. Homologar fechamento concorrente com recebimento e repasse.

Ver [README mestre](../../../README.md). Aplicar CSS global, modais/listas padronizados, máscaras, comentários JSDoc e erros pt-BR. Os testes não foram executados nesta revisão documental.
