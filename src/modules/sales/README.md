# Módulo Vendas

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/sales.js`.
- Serviços e componentes: sales.service.js: fetchSalesWorkspace, consulta vendas e referências.
- Dados e contratos: sales, sale_items, customers.

## Segurança e permissões

Consulta limitada por org_id e filial aplicável; serviço de leitura não realiza mutações financeiras.

## Regras e integrações

Histórico de vendas, itens e totais; reconciliar com Comanda, Caixa e estoque. A consulta tem limite de registros; validar filtros/paginação e não assumir que lista parcial representa faturamento completo. Reembolso de venda quitada precisa de fluxo autorizado.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:sales-service test:comanda test:cash. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
