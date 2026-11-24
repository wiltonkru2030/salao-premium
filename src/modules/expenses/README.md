# Módulo Despesas

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/expenses.js`.
- Serviços e componentes: expenses.service.js: listExpenses/createExpense/payExpense/cancelExpense.
- Dados e contratos: expenses; pay_expense e cancel_expense.

## Segurança e permissões

Cadastro/consulta com org_id e filial; RPC decide pagamento/cancelamento e vínculo de caixa. Não apagar pagamentos para corrigir saldo.

## Regras e integrações

Despesa por categoria, fornecedor, valor, vencimento e status; pagamento com meio escolhido e caixa quando aplicável. Validar duplicidade, cancelamento, concorrência e conciliação.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:expenses-service test:cash. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
