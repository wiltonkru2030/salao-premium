# Testes de integração do backend

O teste `tests/integration/backend-flows.test.mjs` cria dois salões isolados e uma conta profissional em um projeto Supabase dedicado. Ele valida cadastros, Agenda, Comandas, pagamentos parciais e finais, Caixa, comissões, estornos, estoque, concorrência, orçamentos, permissões e isolamento multi-tenant.

## Execução

Use exclusivamente um projeto Supabase de teste, nunca o projeto de produção:

```bash
SUPABASE_URL="https://<projeto-de-teste>.supabase.co" \
SUPABASE_PUBLISHABLE_KEY="<chave-publica>" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-do-projeto-de-teste>" \
npm run test:integration:backend
```

A chave `service_role` é necessária para provisionar contas e remover somente os registros pertencentes aos IDs das organizações e usuários criados pela própria execução. Ela deve permanecer em variável de ambiente/secret e nunca ser commitada.

Use `--keep` somente quando precisar inspecionar os registros criados. Nesse modo, os dados de teste permanecem no projeto e devem ser removidos manualmente após a inspeção, usando os IDs exibidos pelo teste.

## Segurança da limpeza

- Cada execução gera um identificador aleatório e e-mails no domínio reservado `salaopremium.test`.
- A limpeza usa exclusivamente IDs exatos armazenados em memória durante a execução.
- Não usa `LIKE`, nomes de organização, filtros amplos ou exclusão por prefixo.
- Primeiro remove eventos de auditoria e itens da Lixeira das organizações criadas; depois remove essas organizações e as contas de autenticação criadas.
- Falhas de limpeza são reportadas como erro, em vez de declarar a limpeza concluída.

## Limites

Este teste exerce o backend real via Auth, PostgREST e RPC. Ele não substitui inspeção visual de navegador, teste mobile nem validação manual com contas de proprietário e profissional. Não execute sem revisar as variáveis de ambiente e confirmar que apontam para um banco descartável/de testes.
