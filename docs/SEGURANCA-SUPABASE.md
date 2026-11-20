# Auditoria de segurança do Supabase — SALÃO PREMIUM

**Projeto consultado:** vlifbvzlyzoncefvfgol  
**Data da leitura:** 20/11/2026  
**Tipo de acesso nesta auditoria:** somente leitura. Nenhuma migration, configuração de Auth ou dado operacional foi alterado.

## Achados do Security Advisor

O Advisor retornou 16 funções SECURITY DEFINER expostas no schema public e executáveis por authenticated:

- adjust_product_stock
- cancel_expense
- cancel_service_order
- close_cash_register
- open_cash_register
- pay_expense
- pay_professional_commissions
- permanently_delete_recycle_bin_group
- refund_service_order
- register_cash_movement
- register_service_order_payment
- restore_recycle_bin_group
- revoke_professional_app_access
- set_professional_app_access
- start_appointment_group_service_order
- start_appointment_service_order

As definições consultadas já fixam search_path vazio. Isso reduz risco de resolução indevida de objetos, mas não elimina a exposição do endpoint privilegiado no schema público.

### Rascunhos preparados

- docs/sql/security-definer-api-hardening.draft.sql: move 14 implementações para private e preserva os contratos públicos com wrappers SECURITY INVOKER. Concede execução a authenticated e service_role, não a anon.
- docs/sql/commission-refund-reversals.draft.sql: inclui pay_professional_commissions e refund_service_order em versão privada, com wrappers SECURITY INVOKER e compensação de comissão já paga.

Os dois rascunhos precisam ser revisados e aplicados em conjunto, em ambiente de teste. Não executar um deles isoladamente sem conferir o outro.

## Outros achados

- **Proteção contra senhas vazadas desativada.** É uma configuração do Supabase Auth; não é corrigida por migration SQL. Precisa ser ativada no painel do projeto, em Authentication / Password Security.
- As políticas RLS consultadas para commissions, commission_rules, commission_payouts, commission_payout_items, app_settings, service_orders, service_order_items e service_order_payments aplicam escopo por organização e perfil.
- As tabelas de vitrine pública e cupons ainda não existem no schema conectado. Os respectivos SQLs permanecem como rascunhos revisáveis.

## Sequência segura de validação

1. Criar ou selecionar um projeto Supabase de teste com schema compatível.
2. Aplicar os rascunhos em ordem, começando pelo diretório público e seguindo as dependências registradas em docs/PLANO-APLICACAO-SQL.md.
3. Executar testes com perfis anon, authenticated, service_role, owner/admin, financeiro e profissional.
4. Conferir novamente Security Advisor, grants, RLS e search_path.
5. Somente após aceite e autorização explícita, planejar aplicação em produção e rollback.

## Estado

Os testes estáticos versionados verificam contratos, grants e separação SECURITY INVOKER/SECURITY DEFINER; eles não provam a execução do SQL no PostgreSQL nem substituem teste real com papéis distintos.
