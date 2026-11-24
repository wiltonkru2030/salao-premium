# Mapa dos módulos administrativos

Revisão: 24/11/2026. Complementa o [README mestre](../README.md). Os links descrevem responsabilidades, código localizado, contratos de dados, permissões, integrações, padrões e testes. Não são certificação de funcionamento.

| Módulo | Guia |
| --- | --- |
| Agenda, fila de espera e pacotes | [README](../src/modules/agenda/README.md) |
| Comanda | [README](../src/modules/comanda/README.md) |
| Caixa | [README](../src/modules/cash/README.md) |
| Orçamentos | [README](../src/modules/quotes/README.md) |
| Serviços, Produtos, Categorias | [README](../src/modules/catalog/README.md) |
| Clientes | [README](../src/modules/customers/README.md) |
| Profissionais | [README](../src/modules/professionals/README.md) |
| Unidades e filiais | [README](../src/modules/branches/README.md) |
| Equipe e permissões | [README](../src/modules/team/README.md) |
| Comissões | [README](../src/modules/commissions/README.md) |
| Cupons | [README](../src/modules/coupons/README.md) |
| Vendas | [README](../src/modules/sales/README.md) |
| Despesas | [README](../src/modules/expenses/README.md) |
| Financeiro | [README](../src/modules/finance/README.md) |
| Relatórios | [README](../src/modules/reports/README.md) |
| Disponibilidade e expediente | [README](../src/modules/availability/README.md) |
| Configurações | [README](../src/modules/settings/README.md) |
| Dashboard | [Contrato abaixo](#dashboard) |
| Recuperar / auditoria | [Contrato abaixo](#recuperar-e-auditoria) |
| App Profissional | [README](../professional/README.md) |
| Área da Cliente | [README](../cliente/README.md) |

## Dashboard

**Código:** `src/pages/dashboard.js`, funções dashboard e loadDashboard. Composição e consultas ainda na página; extrair serviços e apresentação em mudanças pequenas, com testes de regressão.

**Dados:** appointments, customers, services e professionals. Consultas usam org_id, contagens e escopo de unidade conforme aplicável. Indicadores devem refletir registros reais e respeitar período, status e permissões. Validar quais contagens são por filial ou consolidadas; não confundir contagem de cadastros com faturamento.

**Aceite:** comparar indicadores com registros de QA, testar tenant vazio, erros e troca de unidade durante a consulta, evitar spinner infinito e resultados de sessão antiga. Aplicar CSS global, responsividade e listas/cards. Sem script específico confirmado; executar build, test:tenant e testar navegação no navegador.

## Recuperar e auditoria

**Código:** `src/pages/recycle-bin.js`, funções recycleBinPage e loadRecycleBinPage. Consulta recycle_bin e audit_events; profiles fornece identificação de ator quando autorizada.

**Contratos:** restore_recycle_bin_group e permanently_delete_recycle_bin_group. O servidor deve validar tenant, papel, grupo, expiração, dependências e integridade. Não confiar em IDs, esconder botão como única proteção, restaurar em outra organização ou apagar históricos financeiros. Exclusão definitiva é irreversível; exigir confirmação clara e política de retenção aprovada. A lixeira não substitui backup.

**Aceite:** verificar criação/atualização/exclusão, ator e data/hora; restaurar grupo autorizado, negar acesso cruzado, testar dependência faltante, retenção, logs sanitizados e efeitos sobre vínculos. Testar com registros descartáveis em QA; jamais apagar registros reais para verificar o fluxo. Executar npm run test:sql-global-audit e teste integrado autorizado.

## Contrato comum

Todos os módulos devem usar contexto de sessão, org_id e branch_id aplicável, RLS/RPC, documentação de arquivos e funções, CSS global, máscaras, erros pt-BR, modais e estados loading/vazio/erro. Não declarar cobertura integral de comentários, permissões ou UX sem auditoria executada. Ver [arquitetura](ARCHITECTURE.md), [segurança multitenant](SAAS-MULTITENANT.md) e [design system](DESIGN_SYSTEM.md).

Esta etapa é documental: não altera código executável, permissões ou banco.
