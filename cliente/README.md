# Área da Cliente — SALÃO PREMIUM

Aplicativo independente servido em /cliente/, separado da autenticação administrativa e profissional.

## Estrutura modular
- services/: autenticação, API, perfil, GPS, catálogo, reservas, histórico, cupons, favoritos, notificações e configurações.
- ui/: telas de login, início, agendamentos, perfil, vínculos e navegação.
- styles/: tema, reset, layout, componentes, páginas e responsividade.
- app.js: composição da aplicação e ciclo de sessão.

## Implementado
- Autenticação global encapsulada em services/authService.js: Google e Passkey.
- API HTTP padronizada com timeout e erros em português.
- Perfil global idempotente por auth.uid(), com edição de nome e celular.
- Máscara de telefone brasileiro e normalização E.164; telefone não é marcado como verificado.
- Preferências locais não sensíveis e limpeza restrita de cache.
- Leitura de localização sob ação explícita da cliente; localização não é enviada automaticamente.
- Solicitações de associação de cadastros legados com confirmação da própria cliente.
- Estrutura de histórico de agendamentos, paginação e estados de carregamento/vazio/erro.

## Banco e segurança
- As migrations customer_global_identity, customer_identity_link_hardening e customer_appointment_holds constam no histórico do Supabase.
- RLS do perfil global limita leitura/alteração à identidade autenticada.
- Membership e mapeamento entre identidade e cadastro legado não podem ser gravados diretamente pela cliente.
- A confirmação de vínculo e de reserva ocorre por RPC autenticada e transacional.
- Não confiar em identificadores de usuário/cliente enviados pelo navegador.
- Não expor service_role no código público.
- PIN de quatro dígitos não é autenticação autônoma nem substitui Google/Passkey.

## Pendências que bloqueiam liberação comercial
- O diretório público de salões, a vitrine, catálogo e busca geográfica ainda não estão implantados.
- A reserva temporária existe no banco, mas disponibilidade/expediente e a interface de seleção ainda precisam ser integrados.
- O histórico visual está implementado, mas sua RPC get_my_customer_appointments está somente em docs/sql/customer-appointment-history.draft.sql e ainda não foi aplicada.
- Cupons, favoritos, notificações e preferências remotas ainda não estão integrados.
- Configuração e teste ponta a ponta de Google/Passkey precisam ser concluídos no ambiente de autenticação.

Nenhuma funcionalidade pendente deve exibir dados fictícios ou afirmar sucesso sem confirmação do backend.
