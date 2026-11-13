# Arquitetura e integrações

## Camadas

- **Interface:** páginas JavaScript, componentes reutilizáveis e design system CSS.
- **Orquestração:** `src/app.js`, estado e roteamento.
- **Persistência:** Supabase Auth, Postgres, RLS, triggers e RPCs.
- **Operações críticas:** funções SQL transacionais para pagamentos, comissões, abertura/fechamento de caixa, agrupamento de atendimentos e cancelamentos.

## Fluxo operacional

1. O profissional é vinculado aos serviços que pode executar.
2. A Agenda registra cliente, serviço, profissional, unidade, horário e origem.
3. Ao registrar a chegada, o sistema abre ou reutiliza uma Comanda.
4. Em atendimentos agrupados, todos os serviços são vinculados à mesma Comanda em uma única transação.
5. Cada item da Comanda mantém tipo, serviço/produto, quantidade, preço, desconto e profissional responsável.
6. Cada recebimento confirmado gera pagamento e entrada individual no Caixa.
7. Cada recebimento também gera o lançamento proporcional de comissão para os itens elegíveis.
8. O pagamento de comissão gera uma saída no Caixa e histórico de quitação.
9. O cancelamento de uma Comanda com recebimentos parciais exige estorno integral; cada estorno cria saída no Caixa e atualiza o pagamento original.

## Integridade e autorização

- Toda leitura e gravação deve respeitar organização e, quando aplicável, unidade.
- RLS e funções SQL validam o papel; a interface não é autoridade de segurança.
- Triggers existentes protegem conflito de horários e compatibilidade profissional/serviço.
- Pagamentos, comissões, movimentos de caixa e cancelamentos devem ser atômicos.
- Operações de recebimento, pagamento de comissão, estorno e fechamento bloqueiam a linha do caixa para evitar corrida com fechamento.
- O histórico financeiro não deve ser removido fisicamente.

## Módulos críticos

| Módulo | Interface | Backend principal |
|---|---|---|
| Agenda | `src/agenda/pages/agenda-page.js`, `src/app.js` | `appointments`, `appointment_blocks`, triggers de conflito e atribuição; `start_appointment_group_service_order` |
| Comanda | `src/pages/comanda.js` | `service_orders`, `service_order_items`, `service_order_payments`; `register_service_order_payment`, `cancel_service_order` |
| Caixa | `src/pages/cash.js` | `cash_registers`, `cash_movements`; `open_cash_register`, `close_cash_register` |
| Comissões | `src/pages/commissions.js` | `commission_rules`, `commissions`, `commission_payouts`; `pay_professional_commissions` |

## Padrão de documentação do código

Cada módulo deve ter cabeçalho com objetivo, dependências e efeitos importantes. Funções não triviais devem documentar entradas, saídas, validações, permissões, tabelas/RPCs envolvidas e se a operação é transacional. Comentários devem explicar regras e decisões, não apenas repetir instruções.

## Limitações conhecidas

- A interface de Caixa opera atualmente o caixa padrão da organização (`branch_id IS NULL`); a seleção operacional de caixas por filial ainda precisa de uma tela/fluxo próprio.
- O fluxo de cancelamento/estorno cobre comandas abertas ou parcialmente pagas. Uma venda já quitada e fechada exige fluxo específico de devolução de venda/estoque, não cancelamento simples.
- Testes automatizados de build e regressão não substituem teste ponta a ponta em navegador com contas e registros controlados.
