# Status de prontidão — 19/11/2026

## Resultado executivo

**Não liberar para produção ou venda ainda.** O HEAD atual `7d969a019a034ff0123db569af244927046942c5` passou pelas etapas de sintaxe, build/importações e testes unitários nos workflows consultados. A auditoria ainda identifica funcionalidades demonstrativas, documentação incompleta e validações reais pendentes.

## Validação automatizada

Commit de referência da suíte completa: `91e7d699820d4e8ea14fe4c39da4c99d3efd6616`. HEAD mais recente verificado em 19/11/2026: `7d969a019a034ff0123db569af244927046942c5`.

- Sintaxe de todos os arquivos JavaScript: aprovada.
- Build de produção e importações: aprovado.
- Testes de utilitários, tratamento de erros, Orçamentos, Comanda, Caixa, tenant e Agenda: aprovados.
- Comando agregado `npm run test:all`: aprovado.
- Workflows `App validation` e `Agenda tests`: concluídos com sucesso no commit de referência.
- No HEAD `7d969a019a034ff0123db569af244927046942c5`, o workflow [App validation](https://github.com/wiltonkru2030/salao-premium/actions/runs/44564188918) concluiu sintaxe, build/importações e todos os passos de testes com sucesso; o job ainda estava finalizando quando consultado. O workflow [Agenda tests](https://github.com/wiltonkru2030/salao-premium/actions/runs/44564188931) concluiu com sucesso.
- Após a auditoria inicial, o Dashboard deixou de usar métricas fictícias e passou a consultar atendimentos futuros do dia e contagens de clientes, serviços e profissionais ativos no Supabase, sempre filtrando a organização ativa. Os campos utilizados foram conferidos no schema atual. Essa alteração ainda não equivale a um teste E2E autenticado.

Esses testes não substituem testes E2E, integração com usuários de teste e validação visual em dispositivos reais.

## Documentação do código

A auditoria estática percorreu 107 arquivos (79 JS/MJS) e encontrou 137 declarações exportadas analisáveis:
- 102 com JSDoc;
- 35 ainda sem JSDoc;
- 48 apontamentos estruturais totais, incluindo funções sem documentação, arquivos grandes e linhas extensas.

O verificador ainda é informativo: o CI não falha quando existem apontamentos. Portanto, a documentação não pode ser considerada completa.

## Funcionalidades demonstrativas encontradas

- `src/pages/dashboard.js`: foi conectado ao Supabase no commit `7e2fea4` e ajustado no `cddecb4`; falta validar o fluxo com sessão real e dados de QA.
- `src/pages/records.js`: lista registros locais da estrutura `src/data/index.js`, sem persistência real.
- `src/pages/settings.js`: declara que as preferências são demonstrativas e não persistem no Supabase.
- `src/agenda/services/agenda.service.js`: repositório local em memória, descrito no próprio módulo como legado/demonstrativo.
- `src/pages/branches.js`: substituído o mock por listagem e cadastro de unidades via Supabase, com ativação/inativação para owner/admin e filtro por organização; precisa de teste E2E com perfis distintos.
- Páginas `finance`, `reports` e `sales` ainda reutilizam a listagem genérica de `records.js`; não devem ser tratadas como módulos financeiro/comercial concluídos sem substituir essa fonte.

Esses módulos precisam ser conectados a operações reais, com RLS/RPC quando aplicável, e cobertos por testes. Não basta remover os rótulos demonstrativos.

## Tratamento de erros

O tradutor central foi ampliado para erros PostgreSQL, HTTP 408/429/5xx, autenticação, falhas de rede e mensagens seguras em português. Os testes ampliados passaram no CI.

Ainda falta verificar todos os fluxos de I/O e confirmar que cada tela oferece recuperação adequada, sem operações silenciosamente ignoradas ou estados de carregamento presos.

## Revisão de segurança Supabase — 19/11/2026

- O Security Advisor reportou 16 funções `SECURITY DEFINER` públicas executáveis por `authenticated`. A consulta de privilégios confirmou que nenhuma dessas funções aceita execução pelo papel `anon`.
- A inspeção estática das definições mostrou validação de organização/papel nas 16 funções; 15 incluem verificação explícita de `auth.uid()`. A função de início de grupo de atendimentos valida o papel e o escopo profissional, mas merece teste dedicado com sessão anônima/autenticada antes da liberação.
- As funções verificadas usam `search_path = ''`, reduzindo risco de resolução insegura de objetos.
- O alerta do Advisor, portanto, não comprova acesso anônimo indevido; ainda assim, cada RPC deve ser validada com contas de QA e casos negativos por organização antes de reduzir privilégios ou alterar `SECURITY DEFINER`.
- A proteção contra senhas vazadas permanece desativada no Supabase Auth e precisa ser habilitada nas configurações do projeto.

## Pendências para liberação

1. Documentar as 35 funções exportadas restantes e revisar a qualidade semântica dos comentários.
2. Substituir as fontes demonstrativas/localmente simuladas por fluxos reais persistidos, sem criar dados fictícios no ambiente de produção.
3. Testar E2E Dashboard, Agenda, Comanda, Caixa, Orçamentos, cadastros e App Profissional.
4. Validar isolamento entre duas organizações e entre matriz/filial com contas de QA independentes.
5. Concluir a revisão das permissões/RLS e alertas do Security Advisor, incluindo proteção contra senhas vazadas.
6. Validar visual e responsividade em desktop e celular.
7. Confirmar restauração, auditoria, pagamentos parciais, estornos, estoque e comissões em ambiente isolado.

## Estado Git

A branch de recuperação permanece separada de `main`; a PR #1 está aberta em draft e não foi mesclada. Não houve deploy de produção nesta rodada.


## Atualização — módulo Financeiro
- Implementado painel Financeiro de consulta, conectado ao Supabase e ao carregador da rota.
- Entradas e saídas do caixa são consultadas em `cash_movements`, filtradas por `org_id` e pelo mês atual.
- Despesas cadastradas são consultadas separadamente em `expenses`; despesas pendentes não são somadas às saídas efetivas do caixa.
- Consultas limitadas a 500 registros por conjunto. Não há criação, edição, baixa ou estorno nesta tela.
- Restrições confirmadas no banco: `cash_movements.movement_type` aceita somente `income` e `expense`; despesas aceitam `pending`, `paid` e `cancelled`.
- Validação de código: import e carregador da rota conferidos no commit `ac72445d9d150fcaea4987fc2dd5087194e8418f`. Nenhuma execução de CI foi retornada para esse commit até a última consulta; build, testes automatizados e E2E permanecem pendentes de confirmação.
- Não houve alteração de schema, dados financeiros, permissões, branch principal ou deploy.


## Atualização — módulo Despesas
- Criado `src/pages/expenses.js` com listagem Supabase filtrada por organização, indicadores de pendências e cadastro de despesas com validação de valor e descrição.
- A baixa utiliza a RPC `pay_expense`, que bloqueia a despesa, valida o perfil e registra a saída no caixa na mesma transação quando solicitado. Não há inserção manual paralela em `cash_movements`.
- Cancelamento utiliza a RPC `cancel_expense`; a função do banco só permite cancelar despesas pendentes.
- Schema confirmado: status aceitos `pending`, `paid`, `cancelled`; valores devem ser positivos. RLS de leitura/cadastro/alteração limita a owner, admin, manager e finance; a política de exclusão também permite manager, mas a tela não oferece exclusão.
- Adicionado item Despesas ao menu Financeiro e conectado à página/carregador no compositor.
- Commit de código: `c9363f7de84e8063f507f6d23d9e0432ca1bbf0b`. Conferidos import, rota, carregador e navegação.
- CI para o commit de código `c9363f7de84e8063f507f6d23d9e0432ca1bbf0b`: App validation (run `44567044249`) e Agenda tests (run `44567044545`) concluídos com sucesso. A validação inclui sintaxe de todos os JavaScript, build/importações, auditoria estrutural e testes agregados existentes. Isso não substitui E2E autenticado das novas ações de Despesas.
- Não houve alteração de schema, dados, permissões, branch principal ou deploy. Ainda falta E2E autenticado para cadastrar, pagar com/sem caixa, cancelar, testar perfis e validar isolamento por organização.

## Atualização — fluxo de pagamento de despesas
- A tela Despesas já possuía cadastro, cancelamento e integração com as RPCs transacionais; nesta etapa, o pagamento deixou de usar caixas de prompt e confirmação para escolher a forma de pagamento.
- Adicionado modal de pagamento com forma de pagamento explícita e opção de registrar a saída no caixa. A confirmação chama exclusivamente `pay_expense`; não há inserção manual de `cash_movements` no cliente.
- Cancelamento continua usando `cancel_expense`, restrito pelo banco a despesas pendentes. As RPCs `pay_expense` e `cancel_expense` foram verificadas com EXECUTE para `authenticated` e sem EXECUTE para `anon`.
- Não foi executado pagamento ou cancelamento real nem alterado dado financeiro. Build/CI e teste autenticado seguem pendentes de confirmação.


## Atualização — auditoria do módulo Comissões
- A página `src/pages/commissions.js` já consulta lançamentos, profissionais, regras, pagamentos e referências de itens/recebimentos da Comanda, sempre filtrando a organização ativa.
- Corrigida a mensagem vazia da tela: comissões podem ser geradas proporcionalmente durante pagamentos parciais, não apenas quando a Comanda é quitada. Também foi consolidada a documentação JSDoc do carregador.
- Banco conferido: RLS está habilitado em `commissions`, `commission_rules`, `commission_payouts`, `commission_payout_items` e `app_settings`. As políticas de leitura das comissões limitam a administração/financeiro aos papéis autorizados e o profissional aos próprios lançamentos.
- A RPC `register_service_order_payment` distribui a base da comissão entre recebimentos parciais e conclui o saldo no pagamento final. A RPC `pay_professional_commissions` valida usuário, organização, profissional, seleção e status, bloqueia duplicidade e grava pagamento + saída no Caixa na mesma transação.
- A RPC `refund_service_order` cancela comissões pendentes/aprovadas e bloqueia devolução automática quando já há comissão paga, exigindo ajuste financeiro com o profissional.
- O teste de integração `tests/integration/backend-flows.test.mjs` contém cenários para comissão proporcional, pagamento duplicado, cancelamento com estorno e isolamento entre organizações. Esse teste exige credenciais de QA e **não foi executado nesta etapa**.
- CI do HEAD anterior `a109fe9a9d3b64af550c8545c19255d9461a2c0a`: App validation (run `44577505988`) e Agenda tests (run `44577506011`) concluídos com sucesso. Após a pequena correção de texto/documentação desta etapa, os workflows precisam ser repetidos no novo commit.
- Não houve alteração de schema, permissões, dados financeiros, branch principal ou deploy. O módulo foi auditado e recebeu correção de documentação/clareza; o E2E autenticado com contas QA permanece pendente.


## Atualização — módulo Relatórios
- Substituída a página genérica baseada em `records.js` por um relatório mensal somente leitura, consultando `service_order_payments`, `cash_movements`, `service_orders`, `appointments` e `commissions` do Supabase, sempre com filtro `org_id`.
- Indicadores apresentados: recebimentos confirmados, ticket médio das comandas fechadas, atendimentos concluídos, comandas em aberto, entradas/saídas do Caixa, resultado dos movimentos, comissões geradas/pagas e distribuição dos atendimentos por status.
- Mantidos conceitos separados: recebimentos não são somados novamente às entradas do Caixa; estornos de recebimentos aparecem como saídas quando registrados no Caixa. Comissões geradas usam `created_at`; comissões pagas são consultadas separadamente por `paid_at`, incluindo lançamentos criados em meses anteriores.
- Filtro mensal sem reload da aplicação. Proteção de interface para owner/admin/manager, alinhada às políticas de leitura de Comandas e Agenda; RLS permanece a proteção efetiva no banco. Consultas limitadas a 2.000 registros por conjunto, limite informado na própria tela.
- O módulo não grava dados nem cria métricas estimadas. Ainda requer validação E2E com sessão autenticada, dados de QA e comparação com extratos do Caixa; não foi executado teste visual nem relatório para grandes volumes.
- Não houve alteração de schema, permissões, dados financeiros, branch principal ou deploy.


## Configurações administrativas — implementação inicial

Na revisão de 19/11/2026, a tela demonstrativa de Configurações foi substituída por uma tela conectada ao Supabase:

- Consulta os dados da organização autenticada e suas unidades, sempre filtrando pelo identificador do tenant.
- Permite editar nome, telefone, e-mail, documento e fuso horário da organização; moeda é exibida sem permitir alteração não suportada.
- Permite selecionar uma unidade e editar nome, telefone, e-mail e documento da unidade.
- Formulários são apresentados em modais, com validação básica, bloqueio do botão durante gravação e mensagens de erro em português.
- A interface limita gravações a owner/admin. As políticas RLS verificadas no banco também restringem UPDATE de organizations e branches a administradores da organização; a interface não é a barreira de segurança.
- Alterações em organizations possuem trigger de auditoria no banco. Não foi realizada alteração de schema, política, dado de produção ou configuração do projeto durante esta implementação.
- A tabela app_settings está vazia e sua chave de unicidade inclui branch_id anulável. Não foi usada para inventar preferências ou gravar valores sem contrato de configuração definido.
- Preferências de agenda, notificações, plano/assinatura, autenticação e demais políticas ainda não estão conectadas; a tela as identifica explicitamente como pendentes.
- Não houve teste E2E autenticado ou visual em navegador para esta entrega. A ausência de workflow associado ao commit consultado não permite declarar build ou testes aprovados.


### QA adicional das Configurações

- O teste de integração tests/integration/backend-flows.test.mjs ganhou a etapa 18: proprietário atualiza organização e filial; outro tenant e profissional não conseguem alterar esses registros.
- A etapa usa as sessões autenticadas de dois salões e do profissional criados pela própria suíte. Nenhum dado real é utilizado.
- A execução permanece condicionada a um projeto Supabase descartável, com SUPABASE_URL, chave publicável e SUPABASE_SERVICE_ROLE_KEY configuradas. Não executar contra produção.
- Esta alteração de cobertura foi adicionada ao repositório, mas não foi executada neste ambiente; não declarar o teste aprovado até rodá-lo no projeto de QA.


### Auditoria de permissões dos cadastros — 19/11/2026

- Revisadas as políticas RLS e a interface dos módulos Clientes, Profissionais, Serviços, Produtos e estoque, Equipe e Unidades.
- RLS está habilitada nas tabelas public.customers, professionals, services, products, professional_services, org_memberships, profiles e branches. As consultas da interface de cadastros verificadas filtram pelo org_id ativo; a RLS continua sendo a barreira real contra acesso entre organizações.
- Clientes: a política de INSERT permite owner, admin, manager e receptionist. A tela agora só exibe e aceita o cadastro para esses perfis.
- Serviços e produtos: INSERT/UPDATE/DELETE estão limitados pelas políticas de administrador da organização. A tela agora esconde o botão e bloqueia o envio para perfis que não sejam owner/admin.
- Profissionais e vínculos de serviços: escrita está limitada a owner/admin. A tela agora oculta o cadastro e os controles de acesso para outros perfis e verifica novamente antes do envio/alteração.
- Equipe: o RPC set_professional_app_access valida owner/admin, o alvo dentro da organização e o escopo permitido. A interface também verifica o perfil antes de chamar o RPC.
- As categorias de serviços e produtos continuam sendo texto livre nos respectivos cadastros; não foi encontrada uma tela/tabela de gestão de categorias neste escopo. Não foi criada uma tabela fictícia.
- Nenhuma política RLS, função, dado, usuário ou configuração do Supabase foi alterada nesta etapa. Foram feitas apenas alterações de interface/validação no branch de trabalho.
- Limitação: não houve execução E2E autenticada para cada perfil nem teste visual no navegador. Os controles de interface melhoram a experiência, mas não substituem RLS/RPC. Não declarar a auditoria completa de segurança nem produção pronta até executar os testes em projeto QA descartável.


### Auditoria de autenticação e recuperação de senha — 19/11/2026

- Revisados `src/auth/auth.js`, `src/auth/auth-screen.js`, `src/auth/tenant-context.js`, `src/supabase/client.js` e `src/pages/team.js`.
- Login utiliza `signInWithPassword`; cadastro público utiliza `signUp` com confirmação por e-mail esperada quando o projeto exige confirmação. A senha mínima no cliente é de 8 caracteres. A chave usada no navegador é publishable; não há `service_role` no cliente.
- O contexto administrativo consulta `org_memberships` com `user_id` igual ao usuário autenticado e `status='active'`, e só então carrega as organizações vinculadas. A seleção de tenant é validada novamente contra os vínculos ativos. Não usa `user_metadata` para conceder papel no painel.
- Trigger `on_auth_user_created_salao` executa `private.bootstrap_new_user()`. Para cadastros padrão cria perfil, organização, membership `owner` e unidade matriz. Para metadados `account_type` iguais a `professional`, `receptionist` ou `staff`, cria apenas perfil; não cria membership nem concede acesso ao salão. A decisão usa `raw_user_meta_data`, que é editável pelo usuário; atualmente isso não concede privilégios, mas deve ser substituído por provisionamento confiável do servidor antes de ampliar o fluxo de convites/contas internas.
- O RPC `register_professional_login` não concede EXECUTE a `anon` nem `authenticated`; a função interna `private.bootstrap_new_user` também não é executável por esses papéis. `private.professional_app_profile_id` é executável por `authenticated` e filtra pelo `auth.uid()`, membership ativa, vínculo do profissional e acesso habilitado.
- RLS consultada: `org_memberships` permite ao usuário ler seu próprio vínculo ou administradores lerem os vínculos da organização; `profiles` limita leitura ao próprio perfil ou a perfis de membros em organizações onde o usuário tem papel administrativo/gerencial; atualização de perfil exige que `id=auth.uid()`.
- Falha funcional identificada: não existe fluxo de recuperação/redefinição de senha na interface. O listener de autenticação também não trata o evento `PASSWORD_RECOVERY`; portanto, o link de recuperação não tem uma tela própria para salvar a nova senha. A implementação precisa ser feita e testada com os redirects autorizados no Supabase Auth.
- O Security Advisor continua reportando 16 funções `SECURITY DEFINER` executáveis por `authenticated` e proteção contra senhas vazadas desativada. O primeiro alerta exige revisão individual das validações internas; não foram revogados privilégios automaticamente. A proteção contra senhas vazadas deve ser ativada nas configurações do Supabase Auth.
- Não foram alterados usuários, senhas, sessões, políticas, funções, dados ou configurações do Supabase nesta auditoria. Não foi executado fluxo E2E de e-mail/recuperação nem teste de login com contas QA.


### Implementação do fluxo de recuperação de senha — 19/11/2026

- A tela de autenticação agora oferece `Esqueci minha senha`, formulário de envio do e-mail e formulário para definir/confirmar a nova senha.
- A solicitação usa `supabase.auth.resetPasswordForEmail` e retorna mensagem neutra para não revelar se o endereço está cadastrado.
- O listener trata `PASSWORD_RECOVERY` e apresenta o formulário de redefinição. A gravação usa `supabase.auth.updateUser({ password })`, valida mínimo de 8 caracteres e igualdade entre os campos, e encerra a sessão após sucesso.
- O redirect usa a origem e o caminho atuais (`window.location.origin + window.location.pathname`). A URL precisa estar cadastrada na lista de Redirect URLs do Supabase Auth. O fluxo PKCE depende de `detectSessionInUrl: true`, já habilitado no cliente.
- Commits de implementação: `8ff97adf819effd2f1a2b24d3706de26bb81342e` (lógica), `5411a0189d92b3d18bfcecbb5066a9c187751b55` (telas) e `ad927799c58570f07d2566730991e94eef3b7527` (navegação).
- Não foram alteradas configurações do Supabase, lista de redirects, usuários ou senhas. O envio real do e-mail e o retorno do link ainda precisam ser testados com uma conta QA. Não declarar o fluxo validado em produção até executar esse teste e conferir o provedor SMTP.

- Ajuste adicional: a sessão recebida durante `PASSWORD_RECOVERY` não inicializa o painel administrativo antes de a nova senha ser definida; a tela de redefinição permanece ativa.


### Auditoria do App Profissional — 19/11/2026

- Confirmado que a aplicação ainda compartilha o shell administrativo, mas as políticas RLS do banco já limitam profissionais ativos e vinculados aos próprios dados: `professionals` pelo `profile_id=auth.uid()`, `appointments` pelo profissional vinculado, `service_orders` por profissional responsável/itens atribuídos e `commissions`/pagamentos pelos lançamentos do próprio profissional.
- A função `private.current_professional_id` exige membership ativa com papel `professional`, vínculo `profile_id=auth.uid()` e profissional ativo. `private.professional_app_profile_id` também exige membership ativa, vínculo e acesso habilitado; perfis não profissionais precisam de `professional_app_enabled` e escopo permitido.
- `private.professional_app_scope` retorna `self` para profissional ativo com acesso habilitado; escopos `calendar_all` e `all` dependem de configuração explícita em membership para outros papéis. Funções auxiliares de Comanda conferem vínculo do profissional antes de permitir leitura por item/responsabilidade.
- A tabela `appointments` tem SELECT escopado, INSERT de profissional apenas para seu próprio `professional_id`, origem `professional` e `created_by=auth.uid()`. UPDATE fica limitado a owner/admin/manager/receptionist; profissional não altera diretamente agendamentos por update genérico.
- `service_orders` e `service_order_items` têm políticas de leitura por responsabilidade/itens atribuídos. O profissional não pode efetuar pagamento de Comanda pela tela: ações financeiras são reservadas aos papéis autorizados; pagamento efetivo é feito por RPC transacional.
- `commissions` e `commission_payouts` permitem ao profissional consultar somente os próprios lançamentos/pagamentos. A tela de Comissões não permite que perfil profissional altere regras ou pague comissões.
- Falha de interface encontrada: o menu global não filtrava páginas pelo perfil, expondo links administrativos mesmo quando o banco negaria as consultas. Corrigido `src/layout/render.js`: perfil `professional` agora visualiza somente Agenda, Comanda, Comissões e Configurações; acesso direto a outras rotas é redirecionado à Agenda. A restrição é de navegação, não substitui RLS/RPC.
- O perfil profissional ainda utiliza o shell compartilhado e não tem uma aplicação mobile/PWA independente. A tela Configurações não tem um conjunto específico de preferências do profissional. Esses pontos permanecem pendentes para o App Profissional completo.
- Commit de código: `87f458e8cdaaac38c04e0ae4ae3cf224f465fbca`. Nenhuma policy, RPC, dado ou configuração Supabase foi alterada. Não foram executados testes E2E com contas profissionais, validação visual/mobile ou teste de tentativas negativas por API; build/CI do novo commit ainda precisa ser confirmado.


### Auditoria de ações da Agenda por perfil — 19/11/2026

- Revisadas as políticas RLS de `appointments` e `appointment_blocks`. O perfil profissional pode inserir agendamentos somente para seu próprio `professional_id`, com `booking_source='professional'` e `created_by=auth.uid()`. UPDATE/DELETE de agendamento ficam para owner/admin/manager/receptionist. Bloqueios podem ser inseridos pelo próprio profissional, mas remoção/edição é administrativa.
- O backend possui proteção contra sobreposição de agendamentos e bloqueios no trigger `private.prevent_appointment_overlap`; a validação transacional do banco é a proteção final contra conflitos concorrentes.
- Incompatibilidade de interface corrigida: o drawer de um profissional agora oferece somente iniciar atendimento/abrir comanda, sem confirmação, chegada, reagendamento, cancelamento ou exclusão. Operações sensíveis também têm validações defensivas no controlador/casos de uso. Profissional não pode arrastar e soltar horários nem remover bloqueios.
- Criação de agendamento pelo profissional valida que o profissional selecionado esteja entre os profissionais retornados no escopo próprio da Agenda; edição de agendamento existente é recusada na camada de aplicação para evitar oferecer uma ação que a RLS rejeita.
- Bloqueio de horário continua permitido somente para o próprio profissional; a política RLS também exige `created_by=auth.uid()`. A interface não permite remover bloqueios para esse perfil.
- Fluxo autorizado de iniciar atendimento usa RPC `start_appointment_service_order` / `start_appointment_group_service_order`, que valida autenticação, vínculo do profissional e escopo do atendimento antes de criar/reutilizar a comanda.
- Commits de correção: `f6fe0ea1cf20eb893afcc29ccff3328bc0fd2a41`, `0cd765b9259ee16abc8faf289e745d35af1bdd53`, `e9b4676f2d5d16b9393bf8707b38656bf747dd89`.
- Não foi alterada nenhuma policy/RPC/tabela no Supabase. Não foram executados testes E2E com usuários de QA nem build local; as alterações precisam de validação automatizada e manual antes de produção.


### Auditoria da Comanda do profissional — 19/11/2026

- Revisadas as políticas RLS de `service_orders`, `service_order_items`, `service_order_payments`, `services`, `products` e `professionals`, além das RPCs de iniciar atendimento, registrar pagamento e cancelar/estornar comanda.
- O profissional com escopo `self` pode consultar comandas atribuídas a si e itens vinculados a ele. A inclusão direta de item é limitada pelo banco a `item_type='service'`, ao próprio `professional_id` e a uma comanda atribuída a ele ou ligada a um agendamento seu. Trigger substitui descrição/preço/quantidade/desconto informados pelo cliente pelos dados oficiais do serviço e do profissional.
- A política não permite ao profissional comum inserir produto, editar/excluir itens, alterar preços/descontos ou movimentar pagamentos. O histórico de pagamentos também não é visível ao perfil profissional comum; somente papéis administrativos/financeiros/recepção ou escopo explícito `all` consultam essa tabela.
- RPC `register_service_order_payment` valida autenticação, permissão, saldo, status e Caixa aberto; registra pagamento e movimento de Caixa na mesma transação e, ao quitar, gera venda, estoque e comissões. RPC `cancel_service_order` restringe cancelamento e estorno a papéis autorizados, registra estornos como saídas de Caixa e impede cancelamento se houver comissão já paga.
- Incompatibilidade de interface identificada: `src/pages/comanda.js` usa `canManage()` para habilitar todo o bloco de inclusão de itens. Como o papel `professional` não pertence a esse conjunto, a tela não oferece ao profissional o formulário de adicionar serviço, apesar de a RLS e o trigger permitirem adicionar o próprio serviço. A correção precisa separar “adicionar serviço próprio” de “gerenciar itens/produtos”; não se deve ampliar permissões de banco para contornar o bloqueio visual.
- Outro cuidado de UX: a consulta de pagamentos retorna vazia para profissional comum por desenho da RLS. A tela deve distinguir “histórico financeiro restrito” de “nenhum pagamento registrado”, para não induzir o profissional a interpretar ausência de acesso como ausência de recebimento.
- Não foram alterados código, políticas, RPCs, dados ou configurações Supabase nesta auditoria. O próximo ajuste deve corrigir a interface de inclusão do serviço próprio e a mensagem de visibilidade financeira, seguido de testes unitários e E2E com conta profissional e conta administrativa.
- A RPC de pagamento/cancelamento está executável por `authenticated`, não por `anon`; ambas são `SECURITY DEFINER` e validam `auth.uid()` e o papel/escopo antes de executar operações financeiras. A função interna de cálculo de comissão permanece inacessível diretamente a `authenticated` e `anon`.


### Correção da interface da Comanda para profissional — 19/11/2026

- A tela agora calcula a permissão de lançamento próprio antes de renderizar os detalhes. Para perfil `professional`, o formulário de serviço aparece somente em comanda aberta/em andamento atribuída ao profissional autenticado e cujo vínculo profissional foi confirmado pela consulta sob RLS.
- O profissional não escolhe outro responsável no formulário: o `professional_id` é definido a partir da comanda atribuída. A inserção continua passando pela política RLS e pelos triggers do banco, que exigem o profissional autenticado, serviço ativo e elegibilidade profissional-serviço, além de normalizar descrição, quantidade, preço e desconto.
- Formulário de produto não é renderizado nem inicializado para profissional comum. A consulta do catálogo de produtos é omitida para esse perfil para evitar uma consulta que a RLS corretamente negaria.
- Consulta de pagamentos é omitida para profissional comum. A seção financeira agora informa explicitamente que pagamentos e saldo são restritos, em vez de exibir falsamente “Nenhum pagamento registrado”.
- Testes do componente foram ampliados para garantir que o profissional autorizado veja apenas o formulário de serviço próprio, sem produto, pagamento ou informação enganosa de ausência de recebimentos; também cobre profissional sem vínculo elegível.
- Arquivos alterados: `src/pages/comanda.js`, `src/modules/comanda/components/comanda-detail.js` e `src/modules/comanda/comanda-detail.test.js`.
- Nenhuma policy, RPC, dado ou configuração do Supabase foi alterada. As proteções de banco existentes continuam sendo a autoridade final.
- Ainda é necessário executar a suíte de testes no CI e um E2E autenticado com uma conta profissional real/QA; o teste unitário de apresentação não comprova a autorização ponta a ponta nem a elegibilidade de serviços na base real.


### Auditoria de encerramento e comissões — 19/11/2026

- Revisado o fluxo transacional `register_service_order_payment`: bloqueia pagamento sem autenticação/perfil financeiro autorizado, valida saldo, trava a comanda, exige Caixa aberto da filial (com fallback central), grava recebimento e entrada no Caixa; ao quitar, cria venda/itens, baixa estoque, vincula movimentos à venda, fecha a comanda e marca agendamentos vinculados como concluídos. Qualquer erro na transação interrompe o conjunto, evitando fechamento parcial.
- Revisadas as RPCs de início de atendimento simples e em grupo: validam vínculo do profissional com o agendamento, impedem iniciar agendamento cancelado/concluído/falta, travam registros, reutilizam comanda compatível e evitam duplicar item de serviço por agendamento.
- Revisada a geração de comissões: cada recebimento parcial gera a parcela proporcional por item; o pagamento final gera somente o saldo de base ainda não comissionado. Lançamentos guardam profissional, item, recebimento, base, percentual e valor. Índices únicos por item + recebimento protegem contra duplicidade. Pagamento de comissão bloqueia seleção de outro profissional, lançamento já pago/duplicado e exige Caixa aberto; payout, saída do Caixa e atualização dos lançamentos ocorrem na mesma transação.
- Revisado cancelamento: recebimentos parciais exigem estorno integral, com saídas no Caixa; comissões pendentes/aprovadas são canceladas. Comissões já pagas bloqueiam cancelamento para exigir ajuste financeiro separado.
- **Falha de integração encontrada e corrigida:** a página de Comissões consultava `app_settings`, `commission_rules` e `service_order_payments` mesmo para profissional comum. As políticas RLS corretamente restringem essas tabelas, mas a tela tratava a resposta de acesso negado como falha geral e não carregava as comissões próprias. Agora o perfil profissional omite essas consultas administrativas/financeiras e continua consultando somente suas comissões, seus lançamentos de pagamento, seus itens e serviços permitidos pela RLS. Nenhuma política foi ampliada.
- Ponto de atenção funcional: como o percentual é consultado novamente a cada pagamento parcial, uma alteração da regra entre recebimentos pode fazer parcelas do mesmo item usarem percentuais diferentes. O percentual aplicado fica preservado em cada lançamento, mas ainda não há snapshot único da regra no item da comanda. Antes da produção, decidir e testar a regra comercial desejada (congelar percentual no primeiro recebimento ou aplicar percentual vigente em cada parcela).
- Ponto de atenção de arredondamento: a RPC permite diferença de até R$ 0,01 acima do total por tolerância na validação do saldo. Recomenda-se teste explícito de pagamento excedente de um centavo e, se confirmado no fluxo comercial, endurecer a validação para impedir qualquer recebimento acima do saldo exato.
- Não foram alterados RPCs, policies, tabelas, dados ou configurações do Supabase nesta etapa. Não foi executado pagamento, estorno ou fechamento real. A validação de ponta a ponta ainda depende de contas QA e testes com pagamentos parciais, quitação, estoque, Caixa e pagamento de comissão.
