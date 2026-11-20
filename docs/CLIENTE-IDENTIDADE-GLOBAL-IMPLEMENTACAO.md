# Implementação da identidade global — plano de banco

## Schema inspecionado
- organizations.id e organizations.slug existem.
- customers possui PK id, UNIQUE(org_id,id) e FK de branch composta.
- appointments referencia customers por organização.
- private.has_org_role(uuid,text[]) e private.is_org_member(uuid) existem e são SECURITY DEFINER com search_path vazio; são helpers de equipe, não substituem membership de cliente.
- As tabelas customer_profiles, customer_tenant_memberships e customer_account_customers ainda não existem no banco inspecionado.

## Arquivos
- customer-global-identity.draft.sql: desenho inicial de DDL/RLS, não é migration oficial e não deve ser executado em produção.
- tests/integration/customer-global-identity-rls.test.mjs: teste de leitura cruzada com tokens de duas clientes, configurado por variáveis de ambiente.

## Regras de segurança do desenho
- Perfil global por auth_user_id.
- Membership único por organização e identidade global.
- Associação legado protegida por FK composta (org_id, customer_id) e (org_id, auth_user_id).
- A cliente pode ler somente seu próprio perfil, memberships e associações.
- A cliente pode criar/atualizar somente campos de perfil permitidos; não pode escrever phone_verified_at.
- Não há escrita direta para membership ou mapeamento legado.
- O fluxo de onboarding e associação deverá ser feito por backend privilegiado, com autenticação, validação do tenant, auditoria e idempotência.
- Nenhuma permissão para appointments, comandas, créditos ou pagamentos é concedida aqui.

## Pendências antes da migration oficial
1. Confirmar política de criação do membership (link público do salão, convite ou primeira reserva).
2. Implementar Edge Function ou RPC segura para criar membership e associar cliente legado.
3. Revisar permissões de schema private e trigger function no ambiente local.
4. Executar migration em staging.
5. Rodar testes com duas contas e duas organizações, incluindo tentativa de escrita cruzada.
6. Executar Security Advisors e revisar os alertas existentes.
7. Gerar migration oficial usando Supabase CLI em ambiente local; o CLI não está disponível neste ambiente de edição.
8. Não aplicar no banco de produção sem autorização explícita.
