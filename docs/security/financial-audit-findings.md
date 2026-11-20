# Auditoria financeira aprofundada — SALÃO PREMIUM

Inspeção somente leitura, 20/11/2026. Nenhuma alteração foi aplicada ao banco.

## Evidências

- RLS habilitada nas 54 tabelas públicas consultadas.
- Privilégio TRUNCATE concedido a anon em 35 tabelas e a authenticated em 44. RLS não protege TRUNCATE.
- Função register_service_order_payment: trava comanda, valida saldo, cria pagamento e movimento de caixa, calcula comissões proporcionais.
- Função pay_professional_commissions: exige papel autorizado, valida comissões sem duplicatas e trava registros antes de pagar.
- Função refund_service_order: impede estorno automático de comanda com comissões já pagas, exige caixa aberto, cria saídas e devolve estoque.
- Consultas sobre dados existentes retornaram zero ocorrências de: pagamentos acima do total, bases de comissão acima do item, comissões pagas sem repasse e repasses divergentes dos itens.
- Security Advisor sinaliza proteção contra senhas vazadas desativada.

## Pendências críticas

1. Corrigir privilégios excessivos de TRUNCATE, TRIGGER e REFERENCES após autorização e teste.
2. Validar RLS com usuários de duas organizações distintas; consultas administrativas não substituem esses testes.
3. Testar comissão proporcional em centavos, descontos, produtos e mudança de regra durante pagamentos parciais.
4. Homologar estorno com comissões já pagas e ajustes financeiros sem perda de trilha.
5. Testar operações simultâneas, repetição de requisições, fechamento e conciliação de caixa.

Consulta reproduzível: docs/security/financial-integrity-audit.sql.
