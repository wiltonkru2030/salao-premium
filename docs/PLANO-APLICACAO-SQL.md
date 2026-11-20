# Plano de revisão e aplicação de SQL — SALÃO PREMIUM

## Regra de segurança
Os arquivos marcados como draft são documentos de revisão, não migrations aplicadas. Nenhum deles deve ser executado em produção sem:
1. revisão de schema, grants, RLS e funções;
2. aplicação em projeto Supabase de teste;
3. execução dos testes de integração com dados descartáveis;
4. validação do painel, app da cliente e app profissional;
5. autorização explícita para produção e plano de rollback.

## Migrations já aplicadas no Supabase conectado
- 20261120041015_customer_global_identity.sql e 20261120041034_customer_identity_link_hardening.sql — perfil global, memberships, mapeamento legado e confirmação autenticada.
- 20261120041443_customer_appointment_holds.sql, 20261120041450_customer_appointment_holds_rpc_security.sql, 20261120041537_customer_appointment_hold_cancellation.sql e 20261120041630_customer_appointment_holds_private_rpc.sql — HOLDs transacionais e wrappers invoker.
- 20261120041928_customer_booking_business_and_professional_availability.sql e 20261120063615_enforce_availability_on_admin_appointments.sql — expediente, folgas, fechamentos e conflitos.
- 20261120064407_public_salon_directory_and_availability.sql, 20261120064553_align_public_profiles_with_settings.sql, 20261120064639_restrict_private_schema_public_api.sql e 20261120064758_allow_members_read_public_profile_settings.sql — vitrine, catálogo, busca pública e consulta de horários.
- 20261120065524_customer_coupons_transactional.sql, 20261120065604_restrict_legacy_hold_private_entrypoints.sql e 20261120070111_coupon_fk_indexes_and_public_profile_policy_cleanup.sql — cupons e reserva/resgate transacional.

## Rascunhos ainda pendentes
1. docs/sql/audit-composite-record-identifiers.draft.sql — auditoria/lixeira das tabelas globais e identificadores de chaves compostas; depende das tabelas de identidade global já aplicadas.
2. supabase/migrations/20261120072000_customer_appointment_history.sql — RPC de histórico da própria identidade global autenticada (versionada, ainda não aplicada); docs/sql/customer-appointment-history.draft.sql permanece como referência.
3. docs/sql/customer-engagement.draft.sql — favoritos, notificações internas por trigger e preferências globais.
4. supabase/migrations/20261119170000_snapshot_commission_rate_on_first_payment.sql — congela a regra de comissão no primeiro pagamento do item. Está versionada, mas não consta no histórico do Supabase conectado.
5. docs/sql/commission-refund-reversals.draft.sql — débito de comissões já pagas, compensação automática no próximo repasse e wrappers SECURITY INVOKER.
6. docs/sql/security-definer-api-hardening.draft.sql — move 14 implementações SECURITY DEFINER do schema public para private, mantendo contratos PostgREST em wrappers SECURITY INVOKER.

Os rascunhos de hardening e estorno precisam ser revisados em conjunto: o rascunho de estorno também migra pay_professional_commissions e refund_service_order. Não executar os dois isoladamente sem reconciliar as funções duplicadas.

## Auditoria global
- docs/sql/audit-composite-record-identifiers.draft.sql — atualiza a função de auditoria para registrar identificadores de chaves compostas e instala gatilhos nas tabelas de identidade global. Ainda não aplicada.

## Não incluído nesta etapa
- Definir faixas de comissão progressiva por meta/período, se o negócio realmente exigir faixas variáveis.
- Aplicar os rascunhos pendentes em produção.
- Envio de notificações push, e-mail ou WhatsApp.
