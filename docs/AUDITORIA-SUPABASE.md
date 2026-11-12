# Auditoria Supabase — SALÃO PREMIUM

**Data da verificação:** 12/11/2026  
**Escopo:** banco conectado, políticas RLS, privilégios, funções RPC, Edge Functions, advisors e histórico de migrações.

Esta auditoria é uma leitura do estado atual do projeto. Nenhuma política, permissão, migração ou configuração de autenticação foi alterada durante a inspeção.

## 1. Estado observado

- Projeto ativo e saudável; PostgreSQL 17.
- 31 tabelas identificadas entre os schemas `public` e `private`.
- RLS habilitado nas 31 tabelas verificadas.
- As duas tabelas privadas de autenticação por CPF não concedem privilégios de tabela a `anon` ou `authenticated`.
- As políticas consultadas para tabelas públicas estão direcionadas a `authenticated`; não foi encontrada política de leitura/gravação destinada a `anon` na listagem analisada.
- As tabelas públicas ainda têm privilégios SQL amplos concedidos a `anon` e `authenticated`. O RLS bloqueia as linhas para as quais não existe política aplicável, mas a concessão a `anon` deve ser revista e reduzida ao mínimo necessário.

## 2. Divergência crítica de migrações

O banco informa **36 migrações aplicadas**, enquanto o repositório contém somente **9 arquivos SQL** em `supabase/migrations/`.

Na comparação por versão:
- 33 versões aplicadas no banco não possuem arquivo local com a mesma versão.
- 6 arquivos SQL rastreados não aparecem com a mesma versão no histórico remoto.
- Há mudanças semelhantes com timestamps diferentes, indicando que parte do esquema foi aplicada diretamente pelo painel/MCP e parte foi registrada no Git com outra versão.

**Risco:** o banco de produção e o histórico versionado não são reproduzíveis a partir do repositório atual. Um reset, uma restauração ou uma nova implantação baseada apenas nos nove arquivos locais pode perder objetos ou recriar um esquema incompleto.

**Regra imediata:** não executar reset, reaplicar em lote ou editar manualmente o histórico de migrações. Primeiro reconciliar o esquema remoto com o repositório, gerar um snapshot/migração de baseline e confirmar a sequência com backup. Não apagar versões aplicadas para “fazer os números baterem”.

## 3. Funções SECURITY DEFINER

O advisor identificou sete RPCs `SECURITY DEFINER` executáveis por usuários autenticados:

- `pay_professional_commissions`
- `permanently_delete_recycle_bin_group`
- `register_service_order_payment`
- `restore_recycle_bin_group`
- `revoke_professional_app_access`
- `set_professional_app_access`
- `start_appointment_service_order`

A inspeção das definições atuais encontrou verificações de `auth.uid()` e validações de papel/escopo dentro das funções. O privilégio de execução para `anon` está desabilitado nas sete. Portanto, o alerta de execução por `authenticated` não significa, sozinho, que qualquer usuário possa executar a ação: essas RPCs são pontos de entrada necessários e precisam validar a autorização no corpo.

**Pendência de segurança:** criar testes de integração por papel para provar que proprietário, administrador, gerente, recepção, financeiro e profissional só executam a operação permitida. Manter `search_path` vazio e referências de objetos qualificadas por schema.

## 4. Autenticação e Edge Functions

As duas Edge Functions estão ativas:

| Função | Versão | JWT obrigatório |
|---|---:|---|
| `manage-professional-access` | 9 | Sim |
| `professional-cpf-login` | 5 | Não |

A função de login por CPF não exige JWT porque é o próprio fluxo de entrada; ela valida CPF, aplica limitação de tentativas por IP e CPF com HMAC, resolve a identidade no backend e só então troca credenciais por uma sessão Auth. A função administrativa exige JWT, confirma o usuário e valida vínculo/role owner ou admin antes de gerenciar o acesso.

As chaves administrativas aparecem somente no ambiente server-side das funções, não no frontend.

**Advisor pendente:** a proteção contra senhas vazadas está desabilitada no Supabase Auth. Recomenda-se ativá-la em Authentication → Settings → Password Security e testar o fluxo de criação/alteração de senha.

## 5. Advisories de performance

O advisor registrou:
- 48 chaves estrangeiras sem índice de cobertura.
- 21 índices ainda não utilizados.

Não adicionar 48 índices automaticamente: avaliar as consultas reais, cardinalidade, filtros RLS e planos. Também não remover os 21 índices apenas por estarem sem uso; o projeto é recente e fluxos de pagamento/relatórios podem ainda não ter sido executados. Priorizar as tabelas de maior volume e as consultas mais frequentes.

## 6. Mudança recente do Data API

A documentação/changelog do Supabase informa que, a partir de 30/10/2026, novas tabelas não são automaticamente expostas à Data API por padrão ([aviso oficial](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)). Para novas tabelas, confirmar a exposição e conceder apenas os privilégios necessários, sempre junto com RLS e políticas específicas.

## 7. Plano de ação recomendado

1. Fazer backup e reconciliar as 36 migrações remotas com os nove arquivos locais antes de qualquer nova alteração DDL.
2. Ativar a proteção contra senhas vazadas no Auth.
3. Criar testes de autorização negativos/positivos para as sete RPCs `SECURITY DEFINER`.
4. Rever privilégios de `anon` nas tabelas públicas e revogar o que não for necessário, após confirmar que o cadastro/login público não depende desses grants.
5. Testar RLS com contas separadas: proprietário, recepção, profissional individual e profissional com escopo ampliado.
6. Avaliar os índices com base em consultas reais e planos, sem remoção em lote.
7. Repetir Security Advisor e Performance Advisor depois das correções.

## 8. Limites desta auditoria

A leitura de metadados e funções não substitui testes com sessões reais de cada papel. Não foram executados pagamentos, restaurações, exclusões permanentes, resets, migrações nem alterações de configuração Auth nesta auditoria.


## 9. Metadados de autenticação usados como sinal de fluxo

A função de trigger `private.bootstrap_new_user()` consulta `raw_user_meta_data.account_type` para decidir se deve criar uma nova organização ou somente um perfil interno. O fluxo administrativo de provisionamento define esse valor pela Edge Function, mas `user_metadata` é editável pelo próprio usuário.

O valor não concede uma role nem cria uma associação por si só, portanto não foi identificado aqui um caminho direto de escalada de privilégios. Ainda assim, um cadastro público pode tentar enviar `account_type=professional` e desviar a criação normal da organização, deixando uma conta sem o fluxo esperado de proprietário.

Também foi observado que `must_change_password` é gravado em `user_metadata` e lido pelo App Profissional para exigir a troca da senha temporária. Como esse metadado é editável pelo usuário, essa exigência não deve ser tratada como barreira de autorização ou garantia de segurança.

**Correção recomendada:** mover sinais de provisionamento e a política de troca obrigatória para metadados controlados pelo servidor (`app_metadata`) ou para uma tabela privada de provisionamento. A mudança exige atualizar em conjunto o trigger, a Edge Function e o App Profissional; validar a API Admin atual; e testar cadastro normal, provisionamento profissional, reset de senha e tentativa de alteração dos metadados pelo próprio usuário. Não foi alterado nesta rodada para evitar inconsistência entre o banco e o histórico de migrações ainda não reconciliado.

## 10. Privilégios e schema privado

As tabelas do schema `private` não concedem privilégios de tabela a `anon` nem a `authenticated`. O schema `private` também não concede `USAGE` a `anon`; concede a `authenticated` para permitir o uso interno das funções auxiliares em políticas RLS. A configuração explícita de schemas expostos pelo PostgREST não foi encontrada na configuração consultada; confirmar no painel antes de adicionar schemas à Data API.

As tabelas de `public` mantêm grants de tabela para `anon`, mas as políticas analisadas são destinadas a `authenticated`. Isso não equivale a acesso irrestrito enquanto RLS estiver ativo e sem políticas para `anon`; mesmo assim, recomenda-se reduzir os grants anônimos ao mínimo depois de testar os fluxos públicos de autenticação.


### Manifesto do histórico remoto observado

Versões retornadas pelo Supabase em 12/11/2026:

```text
20261112161153 initial_salao_premium_schema
20261112161333 refine_role_based_access_and_indexes
20261112162027 professional_app_and_service_orders
20261112162105 secure_professional_cpf_auth
20261112162115 professional_login_provisioning_rpc
20261112162202 service_order_total_recalculation
20261112162406 fix_service_order_totals_trigger
20261112162610 tighten_professional_data_access
20261112162757 restrict_professional_module_permissions
20261112162841 enforce_professional_comanda_limits
20261112163107 vault_professional_cpf_pepper_access
20261112163653 allow_professional_read_own_order_items
20261112165404 audit_history_and_recovery_bin
20261112165526 professional_app_access_and_comanda_workflow
20261112170155 appointment_checkin_payment_and_commission_workflow
20261112170218 secure_professional_cpf_pepper_lookup
20261112170347 recycle_bin_retention_and_documentation
20261112170907 appointment_creator_snapshot
20261112171759 app_scope_reception_and_audit_completion
20261112171813 reception_calendar_all_rls
20261112171935 reception_command_operational_access
20261112172256 professional_access_revocation_and_comanda_strategy
20261112172630 fix_comanda_sale_status_on_payment
20261112173203 payment_safe_cancellation_and_security_cleanup
20261112173311 commission_payout_schema_and_history
20261112173328 commission_payout_rpc_and_sales_cash_link
20261112173534 professional_auth_bootstrap_without_tenant_creation
20261112182318 professional_app_scope_hardening
20261112182427 professional_app_scope_role_guard
20261112182626 professional_order_rls_no_recursion
20261112182739 professional_app_owner_and_reception_access
20261112182809 reception_app_scope_safe_until_separate_identity
20261112202823 professional_fiscal_profile_and_service_assignments
20261112202951 enforce_professional_service_assignments
20261112203122 professional_services_policy_optimization
20261112203202 preserve_legacy_appointments_service_links
```
