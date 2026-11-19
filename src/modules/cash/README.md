# Módulo Caixa

Consulta e ações: `src/pages/cash.js`; apresentação do painel: `components/cash-dashboard.js`; abertura e fechamento via `services/cash-operations.js`. O componente recebe dados prontos e não acessa Supabase.

Responsabilidades: abertura, movimentos, conferência e fechamento. Cada movimento financeiro precisa de referência à origem e não pode ser apagado para corrigir saldo.

Dados: `cash_registers`, `cash_movements`, `service_order_payments`, `service_orders`, `commission_payouts`.

Regras: escopo por `org_id` e `branch_id); operações críticas via RPC; bloqueio transacional do caixa para serializar recebimentos, pagamentos de comissão, estornos e fechamento. A interface permite selecionar o Caixa central ou qualquer filial cadastrada. Filiais inativas permanecem visíveis para conciliação e fechamento de caixas existentes, mas não aceitam novas aberturas. Cada caixa possui histórico, resumo, abertura e fechamento próprios. O banco valida o vínculo org_id/branch_id, impede aberturas simultâneas na mesma unidade e preserva a assinatura RPC antiga para abertura do Caixa central. A migration de suporte às filiais permanece pendente de aplicação e validação em QA.
