# Histórico de migrations — reconciliação necessária

## Estado verificado em 13/11/2026
- Supabase remoto: **58 migrations registradas**.
- Repositório `main`: **31 arquivos SQL** em `supabase/migrations/`.
- Divergência: **33 versões remotas sem arquivo correspondente no Git**.

As 33 versões sem arquivo local são:

| Versão | Nome registrado no Supabase |
|---|---|
| `20261112161153` | `initial_salao_premium_schema` |
| `20261112161333` | `refine_role_based_access_and_indexes` |
| `20261112162027` | `professional_app_and_service_orders` |
| `20261112162105` | `secure_professional_cpf_auth` |
| `20261112162115` | `professional_login_provisioning_rpc` |
| `20261112162202` | `service_order_total_recalculation` |
| `20261112162406` | `fix_service_order_totals_trigger` |
| `20261112162610` | `tighten_professional_data_access` |
| `20261112162757` | `restrict_professional_module_permissions` |
| `20261112162841` | `enforce_professional_comanda_limits` |
| `20261112163107` | `vault_professional_cpf_pepper_access` |
| `20261112163653` | `allow_professional_read_own_order_items` |
| `20261112165404` | `audit_history_and_recovery_bin` |
| `20261112165526` | `professional_app_access_and_comanda_workflow` |
| `20261112170155` | `appointment_checkin_payment_and_commission_workflow` |
| `20261112170218` | `secure_professional_cpf_pepper_lookup` |
| `20261112170347` | `recycle_bin_retention_and_documentation` |
| `20261112170907` | `appointment_creator_snapshot` |
| `20261112171759` | `app_scope_reception_and_audit_completion` |
| `20261112171813` | `reception_calendar_all_rls` |
| `20261112171935` | `reception_command_operational_access` |
| `20261112172256` | `professional_access_revocation_and_comanda_strategy` |
| `20261112172630` | `fix_comanda_sale_status_on_payment` |
| `20261112173203` | `payment_safe_cancellation_and_security_cleanup` |
| `20261112173311` | `commission_payout_schema_and_history` |
| `20261112173328` | `commission_payout_rpc_and_sales_cash_link` |
| `20261112173534` | `professional_auth_bootstrap_without_tenant_creation` |
| `20261112182318` | `professional_app_scope_hardening` |
| `20261112182427` | `professional_app_scope_role_guard` |
| `20261112182626` | `professional_order_rls_no_recursion` |
| `20261112182739` | `professional_app_owner_and_reception_access` |
| `20261112182809` | `reception_app_scope_safe_until_separate_identity` |
| `20261112203122` | `professional_services_policy_optimization` |

## Regra de segurança
**Não resetar o banco, não reaplicar migrations remotas e não criar migrations retroativas com conteúdo presumido.** Isso pode duplicar objetos ou destruir dados.

## Plano de reconciliação
1. Recuperar os arquivos SQL originais a partir do histórico Git/backup de quem aplicou as migrations.
2. Comparar cada arquivo com o schema atual e o histórico remoto.
3. Marcar versões como reconciliadas somente quando o conteúdo original for confirmado.
4. Se o original não existir, gerar uma baseline/snapshot revisada em branch separada, sem registrá-la como se fosse a migration histórica original.
5. Manter apenas migrations novas e verificadas versionadas corretamente a partir deste ponto.

As migrations recentes de Caixa/Comanda/Agenda/Orçamentos e tenant access estão versionadas localmente; a divergência histórica anterior permanece aberta.
