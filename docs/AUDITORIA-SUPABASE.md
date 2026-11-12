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
