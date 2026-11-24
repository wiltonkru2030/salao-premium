# Módulo Orçamentos

Implementação atual: `src/pages/quotes.js`.

Responsabilidades: proposta comercial, itens, regras de desconto, validade, aprovação/recusa e agendamento agrupado de serviços. Componentes puros do construtor/lista estão em `components/quote-components.js`; documento imprimível e agendamento estão em `services/quote-workflows.js`; criação e configuração de desconto são RPCs transacionais.

Dados: `quotes`, `quote_items`, `quote_settings`, `quote_discount_services`, `appointment_groups`, `appointments`.

Regras: escopo por organização; tokens públicos são armazenados como hash; GET de resposta pública não altera estado; criação e agendamento devem preservar atomicidade e validade. Orçamento não movimenta estoque, Caixa ou comissão antes da execução do atendimento.

## Revisão 24/11/2026 — requisitos e aceite

- Cadastro rápido de cliente (nome/WhatsApp), múltiplos serviços e produtos, profissionais sugeridos/definidos, descontos percentuais/fixos conforme limites e validade. Cobertura de produtos e cadastro rápido deve ser verificada; não presumir implementação.
- RPCs create_quote_with_items, save_quote_discount_settings e create_quote_appointment_group garantem os contratos de transação; orçamento aceito gera horários por serviço/profissional, com conflito validado.
- PDF via impressão do navegador, dados comerciais e logo quando disponível; WhatsApp abre mensagem, anexo manual. Link de resposta deve usar token seguro armazenado como hash.
- Testes via npm run: test:quotes, test:quote-rules, test:tenant, test:agenda. Homologar orçamento com dois profissionais, desconto, aceite, PDF e agendamento sem duplicação.

Ver [README mestre](../../../README.md). Aplicar CSS global, modais/listas padronizados, máscaras, comentários JSDoc e erros pt-BR. Os testes não foram executados nesta revisão documental.
