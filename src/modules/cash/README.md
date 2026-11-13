# Módulo Caixa

Implementação atual: `src/pages/cash.js`.

Responsabilidades: abertura, movimentos, conferência e fechamento. Cada movimento financeiro precisa de referência à origem e não pode ser apagado para corrigir saldo.

Dados: `cash_registers`, `cash_movements`, `service_order_payments`, `service_orders`, `commission_payouts`.

Regras: escopo por `org_id` e `branch_id); operações críticas via RPC; bloqueio transacional do caixa para serializar recebimentos, pagamentos de comissão, estornos e fechamento. A interface atual opera o caixa padrão da organização.
