# Identidade global da cliente — SALÃO PREMIUM

## Decisão arquitetural

A identidade de autenticação da cliente é **global na plataforma**, independente de salão ou filial. Uma pessoa terá um único usuário Supabase Auth e um único perfil global. O vínculo com cada salão será separado e não dará acesso cruzado aos dados operacionais de outros salões.

Não confundir:
- **Conta global:** identidade de login e perfil básico da pessoa.
- **Vínculo com salão (tenant):** relação entre a conta global e uma organização parceira.
- **Cadastro operacional do salão:** registro local de cliente usado por agendamentos, comandas, pacotes e histórico.
- **Filial:** unidade física dentro da organização; não cria nova identidade.

## Modelo de dados-alvo (proposta, ainda não aplicada)

1. `customer_profiles`: uma linha por `auth_user_id` global, com nome, telefone normalizado, e-mail opcional, foto e preferências globais. O telefone só será marcado como verificado após prova real de posse.
2. `customer_tenant_memberships`: vínculo entre `auth_user_id` e `org_id`, com estado, origem e datas. Restrito ao próprio usuário e à equipe autorizada daquele tenant.
3. `customer_account_customers`: associação entre identidade global, tenant e registros operacionais antigos em `customers`. Chaves estrangeiras compostas mantêm o isolamento por organização.
4. Os registros `customers`, `appointments`, comandas, pagamentos, pacotes e créditos continuam pertencendo ao tenant e, quando aplicável, à filial.
5. Histórico consolidado será entregue por RPCs/views com escopo explícito de tenant; nunca por uma consulta global irrestrita.

A proposta anterior de `customer_accounts(org_id, auth_user_id)` criava uma conta por marca e **não atende** à decisão de identidade global. O SQL em `docs/sql/cliente-identidade-marca.sql` está obsoleto para esta arquitetura e não deve ser aplicado.

## Fluxo de autenticação

- Google OAuth: autenticação pelo provedor e sessão Supabase Auth.
- Passkey: autenticação WebAuthn; a credencial é associada à conta global. A disponibilidade depende da configuração do Supabase e do domínio definitivo.
- Telefone + PIN de quatro dígitos: não liberar como autenticação autônoma enquanto o telefone não tiver sido verificado. Um PIN de 4 dígitos possui apenas 10.000 combinações e não prova posse do número.
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
- Hash forte (Argon2id ou bcrypt com custo apropriado) é obrigatório se algum PIN for persistido no servidor, mas hash não corrige a fraqueza de um PIN de quatro dígitos.
- Não vincular cadastros antigos automaticamente por telefone, e-mail não verificado, nome ou nascimento.
- Nunca conceder ao app cliente acesso geral a dados de outros tenants ou às tabelas financeiras.

## Situação do repositório e do banco

- O banco atual possui `customers` por organização e `branch_id` opcional; agendamentos usam FK composta `(org_id, customer_id)`.
- A inspeção anterior encontrou 17 clientes, 14 sem telefone e 15 agendamentos ligados a cliente. Nenhuma fusão automática deve ocorrer.
- O modelo global descrito aqui é uma especificação de arquitetura, não uma migration pronta.
- Nenhuma tabela ou política nova foi aplicada ao Supabase de produção.
- A migration anterior por marca foi substituída conceitualmente e seu SQL está marcado como obsoleto. Não conectar esse serviço à interface.
- Antes de implementar: gerar migration oficial com Supabase CLI em ambiente local, aplicar em staging, testar duas contas globais em dois tenants, testar RLS cruzada e revisar Security Advisors.

## Próximas entregas

1. Substituir o SQL antigo por migration global com perfil, memberships e vínculos operacionais.
2. Criar testes RLS negativos: cliente A não lê tenant de B; usuário sem membership não lê dados; funcionário não cria vínculo em tenant alheio.
3. Implementar cadastro/login Google e Passkey ligados ao perfil global.
4. Implementar ativação de membership ao acessar um salão.
5. Criar fluxo de confirmação assistida e auditada para cadastros legados.
6. Só depois desenvolver seletor de filial, catálogo, disponibilidade, agendamento e histórico por tenant.
