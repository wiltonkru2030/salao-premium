# Módulo Comissões

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/commissions.js`.
- Serviços e componentes: commissions.service.js: fetchCommissionPageData/fetchCommissionReferences; commission-rules.service.js: createServiceCommissionRule/updateServiceCommissionRule/deleteServiceCommissionRule/saveProductCommissionSetting/payProfessionalCommissions.
- Dados e contratos: commissions, commission_payouts, commission_rules, app_settings, professionals, services; pay_professional_commissions.

## Segurança e permissões

Profissional vê somente extrato autorizado; gestão de percentuais e repasses exige papel autorizado. Pagamento transacional e vinculado ao Caixa. Nunca apagar lançamento para corrigir saldo.

## Regras e integrações

Comissão por valor recebido, taxa por serviço/profissional e produtos configuráveis. Snapshot entre parcelas e reversão de comissão paga exigem validação específica; ver docs/COMMISSIONS.md.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:admin-commissions test:admin-commission-rules test:commission-payout-summary test:sql-commission-snapshot test:sql-commission-reversals-v2. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
