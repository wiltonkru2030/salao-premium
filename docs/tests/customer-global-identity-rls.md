# Testes de isolamento — identidade global da cliente

Este roteiro é obrigatório antes de converter
`docs/sql/customer-global-identity-schema.sql` em migration e antes de liberar
o aplicativo da cliente.

## Fixture de staging

Criar em ambiente local/staging (nunca em produção) duas organizações:
- Org A, cliente operacional A e identidade Auth A.
- Org B, cliente operacional B e identidade Auth B.
- Identidade Auth A com membership ativo somente em Org A.
- Identidade Auth B com membership ativo somente em Org B.

Não reutilizar telefones como critério de identidade. Não usar dados reais.

## Matriz de autorização

| Cenário | Resultado esperado |
|---|---|
| Auth A lê seu customer_profiles | Permitido |
| Auth A lê perfil global de Auth B | Zero linhas |
| Auth A altera seu próprio perfil | Permitido, exceto auth_user_id e phone_verified_at |
| Auth A tenta inserir perfil para Auth B | Bloqueado por RLS |
| Auth A lista memberships | Somente Org A |
| Auth A consulta associação legado | Somente associação de Org A e própria identidade |
| Auth A tenta inserir membership diretamente | Negado por privilégio |
| Auth A tenta criar customer_account_customers diretamente | Negado por privilégio |
| Auth A tenta vincular customer_id da Org B à Org A | Rejeitado pela FK composta |
| Auth A não tem membership na Org B | Nenhum acesso operacional à Org B |
| Membership suspenso | Não libera leitura da associação operacional |
| Usuário anon | Nenhum acesso às três tabelas |

## Verificações SQL de estrutura

Executar em staging depois de aplicar a migration aprovada:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'customer_profiles',
    'customer_tenant_memberships',
    'customer_account_customers'
  )
order by tablename;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'customer_profiles',
    'customer_tenant_memberships',
    'customer_account_customers'
  )
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'customer_profiles',
    'customer_tenant_memberships',
    'customer_account_customers'
  )
order by tablename, policyname;
```

## Testes de sessão

Para cada identidade, executar as consultas usando JWT real de usuário Auth
de staging (não apenas SET ROLE), e validar os resultados da API:

1. Login como Auth A e consultar as três tabelas.
2. Tentar consultar IDs conhecidos de Auth B e Org B.
3. Tentar INSERT/UPDATE com auth_user_id de outra pessoa.
4. Tentar definir phone_verified_at no payload de atualização.
5. Tentar criar membership e associação diretamente.
6. Repetir com Auth B e com sessão anônima.
7. Confirmar que registros antigos de customers e appointments não mudaram.

## Critérios de aprovação

- Nenhuma consulta da cliente retorna dados de outra organização.
- Nenhum usuário altera perfil global de outra identidade.
- Nenhum cliente cria ou transfere vínculos.
- FK composta impede associação cruzada entre organizações.
- Nenhum telefone é considerado verificado sem prova de posse.
- Advisor de segurança sem alerta novo relacionado às três tabelas.
- Testes existentes do projeto continuam verdes.

Este arquivo é um roteiro de teste, não um teste automatizado executável. A
automação real deve usar usuários/JWTs de staging e fixtures isoladas, sem
credenciais privilegiadas no cliente.


## Testes adicionais da associação assistida

Depois de aplicar a migration aprovada em ambiente de QA, configurar:
- `CUSTOMER_A_OWNER_ACCESS_TOKEN`: sessão do owner/admin da Org A;
- `ORG_A_CUSTOMER_ID`: cadastro legado de teste pertencente à Org A;
- `ORG_B_CUSTOMER_ID`: cadastro legado de teste pertencente à Org B.

O script `tests/integration/customer-global-identity-rls.test.mjs` também deve confirmar:

1. Cliente A não executa a RPC de associação de cadastro legado.
2. Owner A associa a identidade autenticada A ao cadastro de teste A.
3. Repetir a mesma associação retorna sucesso sem duplicar o vínculo ou a auditoria.
4. Owner A não associa a identidade A a um cadastro da Org B.
5. Owner A não consegue executar a associação informando a Org B.
6. Profissional e usuário sem papel owner/admin não conseguem associar cadastros.
7. Duas chamadas concorrentes para o mesmo par (org_id, auth_user_id, customer_id) não criam duplicidade; conflito com outro cadastro deve falhar.

A criação de membership durante uma reserva deverá ser testada junto da RPC transacional de HOLD/agendamento. Não deve existir teste que crie membership apenas por abrir o link público de um salão.

O script não usa service_role. Se as variáveis adicionais não estiverem configuradas, somente a etapa de associação assistida será informada como não executada; isso não representa aprovação.
