# Módulo Comanda

Implementação atual: `src/pages/comanda.js`; API de compatibilidade preservada pelo roteador.

Responsabilidades: itens de serviço/produto, profissional por item, pagamentos parciais/totais, saldo, cancelamento e estorno permitido.

Dados: `service_orders`, `service_order_items`, `service_order_payments`, `customers`, `professionals`, `services`, `products`.

Regras: consultas limitadas por `org_id); edição/exclusão de itens bloqueada após recebimento; recebimentos e estornos apenas por RPC com caixa aberto; estoque e comissões não são calculados no cliente.
