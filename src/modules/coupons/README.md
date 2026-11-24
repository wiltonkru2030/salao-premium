# Módulo Cupons

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/coupons.js`.
- Serviços e componentes: coupon.service.js: listCoupons/buildCouponPayload/saveCoupon/deactivateCoupon/formatCouponDiscount/toCouponDateTimeInput.
- Dados e contratos: RPCs save_salon_coupon e deactivate_salon_coupon; consultar migrations de cupons 20261120065524 e 20261120163441.

## Segurança e permissões

Escopo por tenant, autorização no backend e validação da filial/serviço. Não confiar em desconto calculado no navegador.

## Regras e integrações

Criação, edição, inativação, validade, valor/percentual, elegibilidade, limites de uso; reservar uso com HOLD e confirmar idempotentemente. Testar cupom expirado, uso concorrente e cancelamento.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:admin-coupons test:customer-services test:sql-customer-applied-migrations. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
