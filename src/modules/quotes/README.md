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

A busca de cliente usa o autocomplete compartilhado com os contatos já carregados para a organização e a unidade ativa. A busca aceita nome sem acentos e sequência de dígitos do WhatsApp. A proposta envia o identificador do cliente selecionado, e alterar o texto invalida a seleção. O botão de cadastro rápido fica disponível junto à pesquisa. Validade e observações são preservadas quando o construtor é redesenhado ao editar itens.

A inclusão de itens usa a busca compartilhada para serviços e profissionais. As sugestões de serviço exibem nome, preço e duração. A busca de profissionais fica disponível após selecionar o serviço e apresenta somente os habilitados para ele no catálogo carregado. Trocar o serviço limpa o responsável. O campo em branco permite definir o profissional depois, e texto digitado sem seleção não é aceito como vínculo.
