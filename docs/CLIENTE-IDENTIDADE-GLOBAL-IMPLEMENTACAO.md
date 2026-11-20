# Implementação da identidade global — plano de banco

## Schema inspecionado
- organizations.id e organizations.slug existem.
- customers possui PK id, UNIQUE(org_id,id) e FK de branch composta.
- appointments referencia customers por organização.
- private.has_org_role(uuid,text[]) e private.is_org_member(uuid) existem e são SECURITY DEFINER com search_path vazio; são helpers de equipe, não substituem membership de cliente.
- As tabelas customer_profiles, customer_tenant_memberships e customer_account_customers ainda não existem no banco inspecionado.

## Arquivos
- docs/sql/customer-global-identity-schema.sql: desenho inicial de DDL/RLS, não é migration oficial e não deve ser executado em produção.
- docs/sql/customer-global-identity-functions.draft.sql: rascunho da RPC de associação assistida de cadastro legado, sem aplicação no banco.
- tests/integration/customer-global-identity-rls.test.mjs: testes de leitura cruzada, bloqueio de escrita direta e associação autorizada com tokens de QA.

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
1. Criar membership dentro da mesma transação que cria o HOLD/reserva, após validar identidade, organização, filial e disponibilidade; não criar membership apenas por abrir link público.
2. Implementar e revisar a RPC privada de associação de cadastro legado, restrita a owner/admin do mesmo tenant, com auditoria e idempotência.
3. Revisar grants, schema private e auditoria em ambiente local/staging.
4. Executar a migration aprovada em staging e preservar os 17 cadastros operacionais existentes.
5. Rodar testes com duas contas e duas organizações, incluindo tentativas de escrita cruzada e associação duplicada.
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

## Testes de segurança ampliados — 20/11/2026

O teste `tests/integration/customer-global-identity-rls.test.mjs` foi ampliado para validar, com tokens de duas sessões reais:

- leitura do próprio perfil e ausência de leitura do perfil alheio;
- leitura apenas dos próprios memberships e associações legadas;
- bloqueio de criação direta de membership pelo navegador;
- bloqueio de criação direta de associação a cadastro legado;
- bloqueio de alteração de `phone_verified_at` pela própria cliente.

A execução continua condicionada a um projeto Supabase de QA com as variáveis documentadas no cabeçalho do teste. Se o ambiente não estiver configurado, o script informa que foi ignorado; esse resultado não é aprovação de segurança.

### Fluxo backend definido para a próxima implementação

A criação de membership não será exposta como endpoint genérico que aceite apenas `org_id`. Isso permitiria que uma conta se vinculasse arbitrariamente a qualquer salão.

O membership deverá ser criado dentro da mesma transação que cria um HOLD/reserva válida, após o backend confirmar:
- sessão autenticada e titularidade via `auth.uid()`;
- organização e filial ativas e pertencentes entre si;
- serviços públicos ativos e disponíveis naquela filial;
- regras de agenda, duração, profissional e conflito;
- criação efetiva do HOLD com expiração e chave de idempotência.

A associação com `customers` legado continua fora desse fluxo. Ela exigirá confirmação de titularidade separada, auditada e sem correspondência automática por telefone.

**Status atualizado:** os testes negativos foram adicionados ao repositório, mas ainda precisam ser executados com duas sessões reais de QA. O endpoint/RPC de reserva ainda não existe e o banco de produção não foi alterado.


## Atualização de implementação — associação assistida

Foi adicionado `docs/sql/customer-global-identity-functions.draft.sql` com o desenho de uma RPC para associar um cadastro operacional legado à identidade global.

A função proposta:
- usa `auth.uid()` para identificar o operador autenticado;
- exige papel owner/admin ativo na mesma organização;
- confirma que o cadastro operacional pertence ao `org_id` informado;
- confirma que a identidade de destino existe no Supabase Auth;
- impede que uma identidade seja associada a dois cadastros ou que um cadastro pertença a duas identidades;
- cria/ativa o membership de origem `legacy_link`, sem reativar vínculo suspenso;
- registra a associação em `audit_logs`, sem copiar telefone, e-mail ou outros dados pessoais;
- retorna o mesmo resultado em repetição da associação já confirmada;
- expõe somente um wrapper `SECURITY INVOKER`; a lógica privilegiada permanece em `private` com `search_path` vazio.

**Importante:** o membership de uma cliente que está iniciando uma reserva não será criado por um endpoint independente de slug. Ele deverá ser criado dentro da mesma transação do HOLD/reserva, depois da validação de todos os dados e regras de disponibilidade.

O teste de integração foi ampliado para cobrir leitura cruzada, escrita direta proibida, proteção de `phone_verified_at`, associação repetida e tentativas de associação entre organizações. Os cenários que exigem tokens de owner e IDs operacionais de QA só são executados quando as variáveis adicionais estão configuradas.

**Estado desta etapa:** arquivos de especificação e testes atualizados na branch de trabalho. Nenhuma migration foi aplicada, nenhuma tabela foi criada e nenhum dado de produção foi alterado. A migration oficial continua pendente porque o Supabase CLI não está disponível neste ambiente e os testes exigem um projeto de QA isolado.

## Auditoria complementar de permissões e compatibilidade — 20/11/2026

Consulta somente leitura realizada no projeto Supabase conectado:

### Estado real do banco
- A consulta a `information_schema.tables` confirmou que `customer_profiles`, `customer_tenant_memberships` e `customer_account_customers` ainda não existem. O modelo global continua apenas no repositório, sem migration aplicada.
- `org_memberships` contém `org_id`, `user_id`, `role` e `status`; o helper `private.has_org_role(uuid,text[])` valida usuário da sessão, organização, status ativo e papel permitido.
- `audit_logs` possui as colunas usadas no rascunho da associação: `org_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` e `created_at`.
- O papel `authenticated` possui USAGE no schema `private` e EXECUTE no helper `private.has_org_role`. Isso confirma compatibilidade de resolução da chamada no contexto atual, mas não substitui o teste da função final em QA.
- `audit_logs` tem política de SELECT para owner/admin/manager. A consulta de políticas não encontrou política de INSERT para authenticated; a inserção de auditoria do rascunho depende, portanto, do contexto privilegiado da função SECURITY DEFINER e deve ser validada com teste real.

### Security Advisors — estado observado
A consulta Security Advisors retornou:
- 16 avisos de funções SECURITY DEFINER no schema `public` executáveis por `authenticated`. São funções preexistentes do sistema; cada uma precisa de revisão individual de autorização e necessidade de exposição. Não revogar permissões em lote.
- 1 aviso de proteção contra senhas vazadas desativada no Supabase Auth. Avaliar ativação nas configurações de Auth após validar impacto no fluxo de login.
- Nenhum desses avisos foi alterado nesta etapa.

Referência de remediação do aviso de funções: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable  
Referência de remediação de senhas comprometidas: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Revisão de risco do rascunho de associação
- A RPC exige owner/admin da organização da linha e usa `auth.uid()`; não usa metadados editáveis do usuário para autorização.
- A FK composta protege o tenant do cadastro legado.
- O rascunho registra a associação em `audit_logs` e é idempotente para repetição da mesma associação.
- **Pendência de titularidade:** a ação `staff_confirmed` registra que um operador confirmou a associação, mas ainda não existe prova técnica de que a cliente confirmou que aquele cadastro legado é dela. Antes de liberar o fluxo, exigir confirmação explícita da cliente autenticada ou um processo assistido com evidência auditável e revisão humana. Telefone coincidente não é suficiente.
- **Pendência de concorrência:** testar duas chamadas simultâneas tentando associar a mesma identidade ou o mesmo cadastro a destinos diferentes. As restrições UNIQUE protegem a integridade, mas o comportamento e a mensagem de conflito precisam ser verificados com duas sessões reais.
- **Pendência de grants:** revisar privilégios efetivos da função privada e do wrapper público em staging; não conceder USAGE em schema privado nem EXECUTE em funções em bloco sem revisar o conjunto de objetos.

### Conclusão
O schema atual do projeto oferece os objetos operacionais necessários para construir o vínculo global, mas as três tabelas de identidade ainda não foram criadas. A especificação SQL está compatível em termos de tipos e colunas consultadas; a RPC não está validada por execução. Os avisos de segurança preexistentes permanecem abertos. Nenhuma alteração foi feita no banco e nenhum dado foi modificado.


## Próxima etapa — confirmação explícita da titularidade

Foi criado o rascunho `docs/sql/customer-identity-link-confirmation.draft.sql` para substituir o fluxo inseguro de associação imediata por um processo em duas etapas:

1. Owner/admin solicita a associação de um cadastro legado a uma identidade Auth específica.
2. A cliente entra autenticada nessa identidade e confirma a solicitação.
3. Somente a confirmação autenticada efetiva, em uma transação, o membership e o mapeamento legado.
4. A solicitação expira em 48 horas e não pode ser confirmada por outra identidade.
5. A operação gera auditoria com IDs dos envolvidos, sem copiar dados pessoais.

### Proteções incluídas no desenho
- Tabela auxiliar sem acesso direto para anon ou authenticated.
- RPC de solicitação valida papel owner/admin e pertencimento do cadastro à organização.
- RPC de confirmação exige que auth.uid() seja exatamente a identidade destinatária.
- Solicitação expirada, inexistente ou destinada a outra conta é recusada.
- Membership suspenso não é reativado automaticamente.
- Restrições únicas do modelo global continuam impedindo associação duplicada ou cruzada.

### Limitações e validações pendentes
- O arquivo é rascunho SQL, não migration oficial; não foi executado.
- Ainda precisa ser validado em Supabase local/staging, inclusive grants do schema privado, comportamento de concorrência, política de expiração e integração com a interface da cliente.
- O rascunho anterior customer-global-identity-functions.draft.sql representa o fluxo de associação imediata e não deve ser executado até ser substituído/revisado por este fluxo de confirmação.
- A interface para listar e confirmar solicitações ainda não foi implementada.
- Nenhuma tabela foi criada no projeto Supabase e nenhum dado de produção foi alterado.

**Decisão de segurança:** funcionário não pode declarar sozinho que um cadastro pertence à cliente. O sistema precisa da confirmação autenticada da própria identidade global.


Complemento do fluxo: o rascunho também define `get_my_pending_customer_link_requests()`, que retorna somente solicitações pendentes destinadas ao `auth.uid()` da sessão. Isso permite que o aplicativo da cliente apresente a confirmação sem expor a tabela auxiliar nem permitir leitura cruzada. A consulta e a confirmação ainda dependem de validação em QA.


## Migration versionada — 20/11/2026

Foi adicionada a migration `supabase/migrations/20261120050000_customer_global_identity.sql` à branch de desenvolvimento.

Ela reúne:
- Perfil global por `auth.users.id`.
- Membership por organização.
- Mapeamento legado com FK composta `(org_id, customer_id)` e `(org_id, auth_user_id)`.
- RLS e grants mínimos para leitura/edição do próprio perfil.
- Proteção de `phone_verified_at` contra escrita direta.
- Solicitação de associação por owner/admin e confirmação pela cliente autenticada.
- Auditoria da solicitação e da confirmação.
- Rejeição de cadastros já associados e tratamento de conflitos únicos.

O teste `tests/integration/customer-global-identity-rls.test.mjs` foi atualizado para testar o fluxo de duas etapas; o teste antigo da RPC de associação imediata foi removido.

### Estado de execução

- Migration versionada no Git: sim.
- Aplicada no Supabase de produção: **não**.
- Testada em Supabase local/QA: **não comprovado**.
- Teste RLS com duas contas reais: depende das variáveis e dados isolados de QA.
- Não executar a migration em produção antes de validar grants, funções SECURITY DEFINER, triggers existentes e o fluxo com duas sessões reais.

### Nota técnica de expiração

A RPC de confirmação rejeita solicitações expiradas. Ela não tenta gravar `status='expired'` e lançar exceção na mesma transação, pois a exceção faria rollback da atualização. A listagem oculta pedidos expirados; um novo pedido do owner/admin renova a solicitação pendente existente.


### Confirmação na experiência da cliente

A RPC `get_my_pending_customer_link_requests` retorna somente o contexto mínimo para a cliente decidir:
- nome público do salão;
- nome do cadastro legado;
- somente os dois últimos dígitos do telefone, quando disponível;
- identificador da solicitação, organização e expiração.

O identificador interno do cadastro e o telefone completo não são enviados à interface. Foi criado `cliente/services/customerIdentityLinkService.js` para listar e confirmar solicitações, além de `cliente/utils/customerIdentityLinkUtils.js` para validar e normalizar os dados. Os testes puros desses utilitários foram incluídos em `test:customer-services`.

A interface de confirmação foi conectada ao perfil da cliente e ao compositor principal, com estado vazio, exibição dos dados mínimos e confirmação por botão. A experiência ainda depende da migration aplicada em QA e de teste ponta a ponta com duas contas reais.


## Aplicação real no Supabase — 20/11/2026

**Correção de status das seções históricas acima:** as migrations de identidade global foram aplicadas no projeto Supabase conectado após autorização explícita do proprietário. Os registros de histórico retornados pelo Supabase são:

- `20261120041015_customer_global_identity`
- `20261120041034_customer_identity_link_hardening`

As quatro tabelas foram confirmadas no schema `public`:
- `customer_profiles`
- `customer_tenant_memberships`
- `customer_account_customers`
- `customer_identity_link_requests`

A verificação pós-aplicação confirmou RLS habilitado em todas as quatro tabelas. Contagem de políticas: perfil global (3), memberships (1), mapeamento legado (1), solicitações (1). A tabela de solicitações possui política explícita de negação de acesso direto para `authenticated`; o acesso é feito somente pelas RPCs destinadas a essa finalidade.

Índices adicionais cobrem as referências `linked_by` e `requested_by`. A aplicação foi registrada nas migrations versionadas no Git.

### Segurança e testes ainda pendentes

- Security Advisors deixou de apontar tabela de solicitações com RLS sem política após a política explícita de negação.
- Permanecem 16 alertas preexistentes de funções SECURITY DEFINER expostas no schema `public`; não foram alteradas em lote, pois precisam de revisão individual de autorização.
- Permanece o alerta de proteção de senha comprometida desativada no Supabase Auth.
- Os testes de integração que exigem duas contas reais, tokens de cliente e owner/admin ainda dependem de ambiente de QA e não foram considerados aprovados.
- A criação de membership no fluxo de HOLD/reserva ainda precisa ser implementada; abrir um link público não deve criar vínculo.
- O fluxo de associação legado precisa ser testado ponta a ponta com duas sessões reais antes de ser liberado comercialmente.

**Status correto:** tabelas e hardening aplicados e verificados no Supabase; integração ponta a ponta e auditoria global de segurança ainda em andamento. O sistema completo não está declarado pronto para venda.
