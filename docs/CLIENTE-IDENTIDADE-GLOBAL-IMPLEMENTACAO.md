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

## Auditoria somente leitura — 20/11/2026

A estrutura atual do banco foi conferida por consulta somente leitura. Resultado:

- `organizations.id` é UUID; `organizations.slug` é texto e possui restrição UNIQUE.
- `customers.id` e `customers.org_id` são UUID.
- Existe a restrição UNIQUE `customers_org_id_id_key` em `(org_id, id)`, necessária para a FK composta do vínculo legado.
- `customers` já possui FK para `organizations` e FK composta para `branches`.
- O schema `private` existe.
- Os helpers `private.has_org_role(uuid, text[])` e `private.is_org_member(uuid)` existem, são SECURITY DEFINER e usam `search_path = ''`. Eles autorizam equipe do salão e não devem ser reutilizados como prova de membership da cliente.
- As três tabelas globais propostas ainda não existem no banco consultado.
- Nenhuma alteração foi aplicada no Supabase nesta auditoria.

### Decisões de implementação confirmadas

1. Manter `customer_profiles` global por `auth_user_id`, sem coluna `org_id`.
2. Manter membership por `(org_id, auth_user_id)`.
3. Manter a associação de legado com FK composta, impedindo que um registro de cliente de uma organização seja vinculado a outra.
4. Não permitir que o navegador crie membership nem associação a cadastro legado.
5. Não permitir que a cliente atualize `phone_verified_at`; alterar o telefone não significa comprovar posse.
6. Não conceder acesso direto global a agendamentos, comandas, pacotes, créditos ou pagamentos.

### Pendências técnicas antes de criar migration oficial

- Definir o evento de criação do membership: deve ocorrer no fluxo autenticado de primeira reserva ou em convite explícito, com idempotência. Não criar membership só por abrir uma página pública.
- Implementar o fluxo de reserva e a criação do membership em operação backend transacional, validando organização ativa, filial, serviço e identidade autenticada.
- Implementar associação de cadastro legado somente após confirmação explícita/auditada por equipe autorizada ou revisão de titularidade; telefone coincidente não basta.
- Validar grants de execução e uso do schema privado para a função de trigger em ambiente local/staging.
- O teste de integração RLS atual é de leitura e exige duas sessões reais de QA. Sem as variáveis de QA, ele encerra como ignorado; isso não conta como aprovação de isolamento.
- Ampliar os testes em staging para tentativas de escrita proibidas e isolamento de dados operacionais, com limpeza segura dos registros de teste.

**Status:** modelo lógico compatível com as chaves e tipos encontrados, mas ainda não está pronto para produção. A migration permanece como rascunho e depende dos fluxos backend e da validação RLS real.

