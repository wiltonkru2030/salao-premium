# Módulo Orçamentos

Implementação atual: `src/pages/quotes.js`.

Responsabilidades: proposta comercial, itens, regras de desconto, validade, aprovação/recusa e agendamento agrupado de serviços. Componentes puros do construtor/lista estão em `components/quote-components.js`; criação e configuração de desconto são RPCs transacionais.

Dados: `quotes`, `quote_items`, `quote_settings`, `quote_discount_services`, `appointment_groups`, `appointments`.

Regras: escopo por organização; tokens públicos são armazenados como hash; GET de resposta pública não altera estado; criação e agendamento devem preservar atomicidade e validade. Orçamento não movimenta estoque, Caixa ou comissão antes da execução do atendimento.
