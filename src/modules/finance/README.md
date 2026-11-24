# Módulo Financeiro

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/finance.js`.
- Serviços e componentes: finance.service.js: fetchFinanceWorkspace, consulta movimentos e compromissos.
- Dados e contratos: cash_movements, expenses.

## Segurança e permissões

Consultas por tenant e filial aplicável sob RLS; não conceder acesso financeiro por interface.

## Regras e integrações

Separar entradas/saídas efetivas de despesas pendentes; filtrar período e unidade, paginar, conferir totais e estados vazios. Não confundir receita, lucro, saldo de caixa e contas a pagar.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:finance-service test:finance-pagination test:cash. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
