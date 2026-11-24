# Módulo Comanda

Implementação da página: `src/pages/comanda.js`; apresentação dos detalhes em `components/comanda-detail.js`; rótulos e moeda em `comanda.formatters.js`; pagamentos e cancelamento em `services/comanda-operations.js`; API de compatibilidade preservada pelo roteador.

Responsabilidades: itens de serviço/produto, profissional por item, pagamentos parciais/totais, saldo, cancelamento e estorno permitido.

Dados: `service_orders`, `service_order_items`, `service_order_payments`, `customers`, `professionals`, `services`, `products`.

Regras: consultas limitadas por `org_id`; edição/exclusão de itens bloqueada após recebimento; recebimentos e estornos apenas por RPC com caixa aberto; estoque e comissões não são calculados no cliente.

## Revisão 24/11/2026 — regras e aceite

- registerComandaPayment chama register_service_order_payment; cancelComanda chama cancel_service_order. Backend decide saldo, caixa, estoque e comissão; pagamentos exigem centavos exatos, sem arredondamento silencioso.
- Itens são serviços e produtos; profissional opcional conforme regra autorizada. Preservar valor, quantidade e desconto. Alterações após recebimento exigem ajuste financeiro explícito; não sobrescrever histórico.
- Pagamento parcial ou final gera entrada e comissão proporcional; quitação vincula venda e estoque. Estorno de parcial exige saída rastreável; venda quitada e comissão paga têm fluxo de ajuste próprio a homologar.
- Testes: npm run test:comanda, test:cash, test:sql-payment-centavos, test:sql-agenda-order-link, test:admin-commissions (com npm run). Validar pagamentos repetidos, concorrência, caixa correto, estornos e valores com dados QA.

Ver [README mestre](../../../README.md). Aplicar CSS global, modais/listas padronizados, máscaras, comentários JSDoc e erros pt-BR. Os testes não foram executados nesta revisão documental.
