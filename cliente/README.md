# Área da Cliente — SALÃO PREMIUM

Aplicativo independente servido em `/cliente/`, sem compartilhar a tela de autenticação administrativa.

## Implementado nesta etapa

- Entrada com Google OAuth.
- Entrada com Passkey via Supabase Auth (WebAuthn).
- Cadastro de Passkey após autenticação confirmada.
- Mensagens de erro amigáveis em português.
- Sessão persistente gerenciada pelo Supabase Auth.
- Layout responsivo e acessível.

## Dependências de configuração externa

1. Ativar o provedor Google em Supabase Authentication > Sign In / Providers e cadastrar Client ID/Secret.
2. Ativar Passkey em Supabase Authentication > Passkeys.
3. Configurar RP ID com o domínio definitivo e origem HTTPS, por exemplo `app.seudominio.com.br` e `https://app.seudominio.com.br`.
4. Não trocar o RP ID depois que clientes cadastrarem chaves: isso invalida as chaves já registradas.

A integração usa `@supabase/supabase-js` 2.119.0 e a opção experimental `auth.experimental.passkey`. O recurso Passkey do Supabase está em fase experimental.

## Ainda não liberar para produção

- O banco atual não possui vínculo `customers.auth_user_id` nem identidade de cliente compartilhada entre filiais.
- A tabela `customers` atual é por organização e contém `branch_id`; a unificação por marca exige migração de dados e política RLS revisada.
- Não há ainda fluxo público de seleção de marca/unidade, catálogo, disponibilidade, agendamento, cancelamento, histórico ou pacotes.
- PIN local de quatro dígitos não foi habilitado: não é seguro tratá-lo como credencial de servidor ou como prova de identidade. Só deve ser adicionado como bloqueio local após autenticação forte, com armazenamento protegido e recuperação segura.
- O fluxo Google/Passkey autentica a identidade, mas não concede acesso às tabelas de clientes nem cria automaticamente um cadastro de cliente.

## Testes

`node cliente/auth-utils.test.js`

A autenticação Google depende de provider configurado no Dashboard. Passkeys dependem da ativação do recurso e do RP ID/origens configurados no Supabase.
## Identidade única por marca (em preparação)

- O modelo proposto usa `customer_accounts` para uma conta Auth por cliente e organização.
- `customer_account_customers` liga vários cadastros operacionais de filiais à mesma conta sem apagar histórico.
- Serviço e validadores em `customer-account.js` e `customer-account-utils.js`.
- SQL de referência em `docs/sql/cliente-identidade-marca.sql`; documentação em `docs/CLIENTE-IDENTIDADE-MARCA.md`.
- A RPC ainda não foi aplicada ao banco; o serviço não deve ser chamado pela interface até a migration oficial ser validada em ambiente de teste.
- Registros antigos não serão associados automaticamente por telefone/data de nascimento: a inspeção encontrou muitos cadastros sem telefone. A recepção terá de confirmar a identidade ou um futuro OTP poderá verificar o número.
