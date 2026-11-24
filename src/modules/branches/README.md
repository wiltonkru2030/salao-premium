# Módulo Unidades e filiais

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/branches.js`.
- Serviços e componentes: branches.service.js: listBranches/saveBranch/setBranchActive; branch-context.service.js: contexto de unidade.
- Dados e contratos: branches; relação com organizations, catálogo, caixa e perfis públicos.

## Segurança e permissões

Toda mutação exige org_id. Preservar matriz, impedir inativação/edição indevida dela pelo fluxo de filiais; selecionar unidade somente autorizada. Não tratar filtro visual como segurança.

## Regras e integrações

Uma matriz por empresa, filiais opcionais, edição de contato e documento. Endereço, logo, CEP e vitrine/link próprios são requisitos a verificar nas configurações. Inativas permanecem no histórico; validar operação e visão consolidada.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:branches-service test:branch-context test:sql-branch-service-catalog test:sql-cash-register. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
