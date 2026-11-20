# Área da Cliente — SALÃO PREMIUM

Aplicativo independente servido em `/cliente/`, sem compartilhar a tela de autenticação administrativa.

## Base implementada

- Entrada com Google OAuth.
- Entrada com Passkey via Supabase Auth (WebAuthn).
- Cadastro de Passkey após autenticação confirmada.
- Mensagens de erro amigáveis em português.
- Sessão persistente gerenciada pelo Supabase Auth.
- Layout responsivo e acessível.

## Decisão de identidade global

A cliente terá uma única conta na plataforma, independente de quantos salões parceiros utilizar. O perfil global será separado dos vínculos por organização e dos cadastros operacionais locais. Agendamentos, comandas, pacotes, créditos e histórico continuam isolados por tenant e filial.

Especificação: `docs/CLIENTE-IDENTIDADE-MARCA.md`.

## Segurança do PIN e telefone

- Telefone + PIN de quatro dígitos não será habilitado como login autônomo sem verificação real de posse do número.
- Google e Passkey serão os métodos principais sem dependência de SMS/WhatsApp.
- PIN local poderá ser usado para desbloquear o app no mesmo aparelho após autenticação forte, nunca como prova de identidade ou recuperação em aparelho novo.
- Não associar cadastro legado apenas por telefone, nome ou data de nascimento.
- Nunca persistir PIN em texto puro. Mesmo hash forte não torna quatro dígitos uma credencial suficiente sem rate limit e prova de identidade.

## Dependências de configuração externa

1. Ativar Google em Supabase Authentication > Sign In / Providers e configurar Client ID/Secret.
2. Ativar Passkey em Supabase Authentication > Passkeys.
3. Configurar RP ID com o domínio definitivo e origem HTTPS.
4. Não alterar RP ID após clientes cadastrarem chaves.

A integração usa `@supabase/supabase-js` e a API experimental de Passkey; validar compatibilidade antes de produção.

## Não liberar para produção

- O fluxo de perfil global e memberships ainda não foi migrado para o banco.
- O SQL anterior de identidade por marca está obsoleto e não deve ser aplicado.
- Não há ainda fluxo completo de seleção de salão/filial, catálogo, disponibilidade, agendamento, cancelamento, histórico ou pacotes.
- O cadastro legado requer confirmação de identidade antes do vínculo.
- Nenhuma alteração foi aplicada ao banco de produção.


## Perfil global da cliente (primeira camada)

- Utilitários puros em `customer-profile-utils.js` validam nome, e-mail, foto HTTPS e normalizam telefone para E.164.
- Telefone normalizado continua **não verificado**; a normalização não autentica nem prova posse do número.
- Testes locais em `customer-profile-utils.test.js`, incluídos em `npm run test:all`.
- Ainda não existe gravação do perfil global no banco: aguardar modelo e políticas RLS em migration de staging.
