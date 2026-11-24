# Identidade global da cliente — SALÃO PREMIUM

> Revisão documental: 24/11/2026. Evidências do código e inventário de 20/11; não houve nova consulta ao banco ou execução de testes nesta revisão. Consulte o README mestre.

## Decisão arquitetural

A identidade de autenticação da cliente é **global na plataforma**, independente de salão ou filial. Uma pessoa terá um único usuário Supabase Auth e um único perfil global. O vínculo com cada salão será separado e não dará acesso cruzado aos dados operacionais de outros salões.

Não confundir:
- **Conta global:** identidade de login e perfil básico da pessoa.
- **Vínculo com salão (tenant):** relação entre a conta global e uma organização parceira.
- **Cadastro operacional do salão:** registro local de cliente usado por agendamentos, comandas, pacotes e histórico.
- **Filial:** unidade física dentro da organização; não cria nova identidade.

## Modelo de dados global versionado

1. `customer_profiles`: uma linha por `auth_user_id` global, com nome, telefone normalizado, e-mail opcional, foto e preferências globais. O telefone só será marcado como verificado após prova real de posse.
2. `customer_tenant_memberships`: vínculo entre `auth_user_id` e `org_id`, com estado, origem e datas. Restrito ao próprio usuário e à equipe autorizada daquele tenant.
3. `customer_account_customers`: associação entre identidade global, tenant e registros operacionais antigos em `customers`. Chaves estrangeiras compostas mantêm o isolamento por organização.
4. Os registros `customers`, `appointments`, comandas, pagamentos, pacotes e créditos continuam pertencendo ao tenant e, quando aplicável, à filial.
5. Histórico consolidado deve ser entregue por RPCs/views com escopo explícito de tenant; nunca por uma consulta global irrestrita.

A proposta anterior de `customer_accounts(org_id, auth_user_id)` criava uma conta por marca e **não atende** à decisão de identidade global. O SQL em `docs/sql/cliente-identidade-marca.sql` está obsoleto para esta arquitetura e não deve ser aplicado.

## Fluxo de autenticação

- Google OAuth: autenticação pelo provedor e sessão Supabase Auth.
- Passkey: autenticação WebAuthn; a credencial é associada à conta global. A disponibilidade depende da configuração do Supabase e do domínio definitivo.
- Telefone + PIN de quatro dígitos: não utilizar como autenticação autônoma, mesmo após verificar o telefone. Um PIN de 4 dígitos possui apenas 10.000 combinações e não prova posse do número.
- PIN local: pode ser oferecido depois de Google/Passkey para desbloqueio local do app, armazenado usando mecanismo seguro do dispositivo. Não enviar PIN ao banco nem usá-lo para recuperar conta em aparelho novo.
- Sem SMS/WhatsApp OTP: a cliente pode usar Google/Passkey. Para primeiro vínculo de um telefone sem OTP, exigir autenticação forte e/ou confirmação assistida pelo salão; não assumir que o número digitado é confiável.

## Cadastro e vínculo com salões

1. A cliente autentica uma vez com Google ou Passkey.
2. O sistema cria/atualiza o perfil global com dados básicos. O telefone permanece não verificado até existir prova adequada.
3. Ao abrir um link de salão ou iniciar uma reserva, o backend identifica o tenant pelo slug/link e cria ou ativa um membership idempotente para a conta autenticada.
4. O app só consulta dados daquele tenant após validar membership e políticas RLS.
5. Se existir cadastro operacional antigo, a recepção confirma a identidade antes de associá-lo. Telefone não verificado, nome ou data de nascimento não são prova suficiente.
6. A reserva, pacote, crédito, comanda e histórico continuam sempre escopados ao tenant e à filial correspondente.

## Proteções obrigatórias

- Nunca aceitar `auth_user_id` enviado pelo navegador como identidade: usar `auth.uid()` no backend.
- RLS em todas as tabelas expostas, políticas por usuário e tenant, e chaves compostas para impedir associação entre tenants.
- RPCs privilegiadas em schema não exposto, `search_path` fixo, validação de sessão/tenant/role e grants mínimos.
- Mensagens de login neutras para evitar enumeração de contas.
- Limites de tentativas e bloqueio progressivo para qualquer credencial baseada em PIN; logs sem PIN ou segredos.
- Não persistir PIN local no servidor; limitar tentativas e proteger o armazenamento do dispositivo.
- Não vincular cadastros antigos automaticamente por telefone, e-mail não verificado, nome ou nascimento.
- Nunca conceder ao app cliente acesso geral a dados de outros tenants ou às tabelas financeiras.

## Situação do repositório e do banco

A migration `20261120041015_customer_global_identity.sql` foi localizada no Git e cria customer_profiles, customer_tenant_memberships, customer_account_customers, customer_identity_link_requests, políticas RLS e RPCs de solicitação, consulta e confirmação de vínculo. O inventário de 20/11 também registra 20261120041034 (endurecimento de identidade), HOLDs, diretório, histórico, cupons e fidelidade.

A proposta antiga por marca não deve ser aplicada. A existência de migrations não comprova o funcionamento atual do banco.

## Homologação

Testar Google/Passkey, PIN exclusivamente local, vínculo assistido, idempotência, duas contas em dois tenants, RLS negativa, tentativa de associação em tenant alheio, logout/troca de conta, histórico e reservas. Executar npm run test:customer-rls apenas em QA autorizado. Preservar cadastros e histórico existentes; jamais mesclar automaticamente.

Ver [Área da Cliente](../cliente/README.md), [README mestre](../README.md) e [inventário](migrations/remote-history-2026-11-20.json).
