# Módulo Relatórios

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/reports.js`.
- Serviços e componentes: reports.service.js: queryReports; reports.rules.js: calculateReportIndicators; reports.view.js: apresentação.
- Dados e contratos: Consultas por org_id e intervalo de datas; inspecionar cada fonte no serviço antes de alterar indicadores.

## Segurança e permissões

RLS limita dados; verificar escopo por filial antes de afirmar relatórios por unidade. Não enviar dados pessoais sem necessidade.

## Regras e integrações

Indicadores com período consistente, limite superior exclusivo, ordenação estável e filtros. Validar precisão contra movimentos reais, paginação e exportação se implementada. Não apresentar números simulados.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:all (regressões relacionadas; script específico de relatórios não confirmado). Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
