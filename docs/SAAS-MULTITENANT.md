# SaaS multitenant — contrato de isolamento

## Modelo
Cada salão é uma organização independente. O mesmo usuário pode, futuramente, participar de mais de uma organização; portanto, a identidade do usuário não substitui o vínculo de membership.

- `auth.users`: identidade e sessão.
- `org_memberships`: vínculo do usuário com a organização e seu papel.
- `org_id`: fronteira obrigatória dos dados do salão.
- `branch_id`: unidade/filial dentro da organização.
- `professional_id`: escopo adicional do App Profissional, nunca substitui o tenant.

## Regras obrigatórias em cada camada

### Interface
- Usar a organização ativa carregada pela autenticação.
- Limitar consultas com `org_id`; filtrar `branch_id` quando a tela operar uma unidade.
- Não aceitar `org_id`, papel, profissional ou permissões de campos editáveis como prova de autorização.
- Limpar estado e dados em memória ao trocar de organização ou encerrar sessão.
- Não misturar listas/cache de tenants diferentes.

### Banco
- RLS habilitada em todas as tabelas expostas com dados de tenant.
- Políticas SELECT/INSERT/UPDATE/DELETE devem validar membership, papel e, quando aplicável, profissional e filial.
- UPDATE deve ter `USING` e `WITH CHECK` para impedir mover registro para outro tenant.
- Chaves estrangeiras compostas ou triggers devem impedir vínculos cruzados entre organizações.
- RPCs devem validar `auth.uid()`, membership e papel dentro do banco; `org_id` recebido é apenas uma solicitação, não uma autorização.
- Funções privilegiadas devem usar `search_path` seguro, validar tenant e ter grants mínimos.
- Nunca confiar em `raw_user_meta_data/user_metadata` para autorização.
- Nunca expor chave `service_role` no navegador.

## Auditoria executada
Foi consultado o estado de RLS das tabelas centrais:
`organizations`, `customers`, `professionals`, `services`, `products`, `appointments`, `appointment_blocks`, `appointment_groups`, `service_orders`, `service_order_items`, `service_order_payments`, `cash_registers`, `cash_movements`, `commissions`, `quotes` e `quote_items`. Todas retornaram RLS habilitada.

As políticas consultadas usam funções de membership/role e escopo profissional, com permissões diferentes por operação. Isso é uma verificação estrutural, não um teste completo de isolamento com dois usuários reais.

## Seleção e troca de tenant
Quando a conta possui mais de uma associação ativa, o login exige que a pessoa escolha a organização. O seletor no topo permite trocar de tenant sem encerrar a sessão; a troca limpa filtros, drawers, Agenda e dados operacionais em memória antes de recarregar a tela.

## Correção aplicada nesta auditoria
As RPCs de liberação e revogação do App Profissional agora recebem `p_org_id`, validam o papel owner/admin nessa organização e só alteram o vínculo dentro do mesmo tenant. As assinaturas antigas que escolhiam automaticamente a primeira organização tiveram EXECUTE revogado para `authenticated`, `anon` e `public`.

## Integridade de migrations
O histórico remoto tem 58 versões e o repositório 31 arquivos SQL; 33 versões antigas não têm arquivo local correspondente. Essa divergência deve ser reconciliada com os arquivos originais antes de qualquer operação de migração em lote. Consulte `docs/MIGRATIONS.md`.

## Pontos de segurança ainda abertos
- O advisor do Supabase sinaliza 11 funções `SECURITY DEFINER` executáveis por usuários autenticados. As funções críticas foram criadas para operações controladas e não devem ser revogadas em lote. Cada função deve ser revisada quanto a validação de tenant/papel e necessidade de exposição.
- A proteção de senha comprometida do Supabase Auth está desativada; habilitar em Authentication → Settings → Password Security.
- O isolamento por filial ainda não está implementado como seletor universal em todos os módulos; o Caixa administrativo atualmente opera o caixa padrão da organização.

Migration: `20261113011915_scope_professional_app_access_to_explicit_tenant`.

## Teste de aceitação multitenant obrigatório
Criar duas organizações de teste A e B, com usuários distintos e registros parecidos. Confirmar que:
1. usuário A não lista, lê, atualiza, exclui ou associa clientes/profissionais/serviços da B;
2. A não cria pagamento, movimento de caixa, comissão, orçamento ou agendamento usando IDs de B;
3. trocar tenant limpa filtros, cache, seleções, drawers e estado anterior;
4. profissional de A não vê Agenda, Comanda, pagamentos ou comissões de B;
5. RPCs rejeitam tenant/filial/IDs de outra organização mesmo se chamadas manualmente fora da interface.

Não marcar o SaaS como pronto para produção antes desse teste.

## Escopo de filial — implementação versionada na PR

As migrations abaixo foram adicionadas à branch de recuperação e ainda não foram aplicadas ao Supabase de produção:

- `20261116020000_branch_membership_access_foundation.sql`: cria `org_membership_branch_access` e a função privada `private.has_branch_access(org_id, branch_id)`.
- `20261116030000_enforce_branch_access_rls.sql`: acrescenta políticas RLS restritivas às tabelas operacionais e às tabelas filhas. As políticas permissivas existentes continuam determinando os papéis e operações permitidos; a nova política exige também o vínculo explícito com a unidade.
- `20261116040000_manage_membership_branch_access.sql`: disponibiliza a RPC transacional `set_org_membership_branch_access`, exclusiva para owner/admin, para substituir as unidades atribuídas a um membro.
- `20261116050000_guard_branch_access_in_privileged_rpcs.sql`: adiciona validações de filial dentro das RPCs `SECURITY DEFINER` de caixa, comanda, despesas e atendimento, restringe funções auxiliares financeiras e impede baixa/devolução de estoque cruzando unidades.

### Semântica de acesso
- Owner/admin ativo: acesso global a todas as unidades da organização.
- Demais membros ativos: acesso somente às filiais explicitamente atribuídas.
- No rollout inicial, a migration cria atribuições temporárias para todas as unidades ativas dos membros já existentes, preservando o acesso anterior; o administrador deve revisar e reduzir essas permissões na tela Equipe antes de declarar o isolamento homologado. Novos membros exigem atribuição explícita.
- `branch_id = NULL` na tabela de atribuições representa acesso à matriz.
- Array vazio enviado à RPC remove as atribuições e bloqueia o acesso operacional do membro às tabelas protegidas.
- A linha da unidade principal em `branches` é tratada como matriz para fins de RLS, embora possua UUID próprio no cadastro.
- Itens de comandas, vendas, orçamentos, grupos de agendamento e pagamentos de comissão herdam a autorização da entidade-pai.

### Interface de administração
A tela **Equipe e permissões** permite selecionar uma ou várias unidades por usuário e salvar as atribuições em uma única chamada transacional. Proprietários e administradores são apresentados com acesso global; a tela de gerenciamento fica restrita a esses papéis.

### Homologação ainda obrigatória
Antes de aplicar as migrations:
1. Validar a sequência e sintaxe das quatro migrations em um banco de teste alinhado ao schema remoto.
2. Testar owner/admin com acesso global, incluindo a leitura da linha da matriz.
3. Testar recepção, financeiro, gerente, viewer e profissional com atribuição a uma filial, à matriz, a múltiplas unidades e sem unidade.
4. Testar SELECT/INSERT/UPDATE/DELETE e RPCs nas tabelas principais e filhas, inclusive tentativa de alterar `branch_id` para unidade não atribuída.
5. Testar usuários legados sem atribuição e definir plano de provisionamento antes da ativação da RLS restritiva.
6. Confirmar que a troca de unidade no frontend oferece somente as unidades autorizadas.
7. Reexecutar os testes automatizados e revisar Supabase Security Advisors após aplicação controlada em ambiente de homologação.

A existência das migrations e da tela não significa que o isolamento por filial já está ativo. O Supabase de produção permanece sem essas alterações até autorização e homologação.

### Dados organizacionais ainda compartilhados entre unidades

A auditoria do schema encontrou tabelas sem `branch_id` que continuam com escopo de organização, e não de unidade. Entre elas:

- Catálogo e regras compartilhadas: `services`, `commission_rules`, `professional_services`, `quote_settings` e `quote_discount_services`.
- Estruturas administrativas/identidade: `org_memberships`, `notifications`, `audit_events`, `audit_logs` e `recycle_bin`.

Os itens de orçamento, venda, comanda, grupo de agendamento e payout herdam a unidade do respectivo registro-pai. Já o catálogo de serviços ainda é comum à organização; a separação de catálogo, disponibilidade e regras de comissão por filial precisa de uma etapa de modelagem própria, pois não deve ser simulada apenas com filtros de interface.
