# Área da Cliente — SALÃO PREMIUM

Aplicativo independente servido em /cliente/, separado da autenticação administrativa e profissional.

## Estrutura modular
- services/: autenticação, API, perfil, GPS, diretório público, catálogo, disponibilidade, reservas, histórico, cupons, favoritos, notificações e configurações.
- ui/: telas de login, início, busca pública, detalhe do salão, agendamentos, perfil, vínculos e navegação.
- styles/: tema, reset, layout, componentes, páginas e responsividade.
- app.js: composição da aplicação e ciclo de sessão.

## Implementado no código
- Autenticação global encapsulada em services/authService.js: Google e Passkey.
- API HTTP padronizada com timeout e erros em português.
- Perfil global idempotente por auth.uid(), com edição de nome e celular.
- Máscara de telefone brasileiro e normalização E.164; telefone não é marcado como verificado.
- Preferências locais não sensíveis e limpeza restrita de cache.
- Leitura de localização sob ação explícita da cliente; coordenadas são usadas apenas na busca solicitada.
- Solicitações de associação de cadastros legados com confirmação da própria cliente.
- Busca pública de salões por nome, cidade/UF ou coordenadas; resultados exibem apenas unidades publicadas.
- Detalhe de salão com catálogo de serviços e profissionais ativos.
- Consulta de disponibilidade, criação de HOLD, confirmação e cancelamento temporário integrados aos serviços Supabase.
- Histórico de agendamentos com paginação e estados de carregamento/vazio/erro.
- Formulário administrativo de vitrine pública em Configurações, condicionado à existência das tabelas/RPCs de publicação.
- Favoritos por identidade global, com tela própria e remoção; a lista mostra somente unidades publicadas.
- Central de notificações internas com leitura individual e em lote; o backend proposto gera eventos quando agendamentos são criados, confirmados, cancelados, concluídos ou remarcados.
- Sincronização remota de preferências (tema, lembretes, promoções e região), mantendo fallback local até a RPC ser implantada.
- Validação de cupons por salão/filial/serviço, prévia de desconto e reserva do uso na mesma transação do HOLD; o backend recalcula o desconto antes de confirmar o preço final.

## Banco e segurança
- As migrations customer_global_identity, customer_identity_link_hardening e customer_appointment_holds constam no histórico do Supabase.
- RLS do perfil global limita leitura/alteração à identidade autenticada.
- Membership e mapeamento entre identidade e cadastro legado não podem ser gravados diretamente pela cliente.
- A confirmação de vínculo e de reserva ocorre por RPC autenticada e transacional.
- O diretório público usa tabelas separadas, RLS owner/admin e RPCs com lista explícita de campos públicos.
- Publicação é opt-in por organização e unidade; não há SELECT anônimo nas tabelas operacionais.
- Não confiar em identificadores de usuário/cliente enviados pelo navegador.
- Não expor service_role no código público.
- PIN de quatro dígitos não é autenticação autônoma nem substitui Google/Passkey.

## Pendências que bloqueiam liberação comercial
- As migrations revisáveis docs/sql/customer-public-directory.draft.sql, docs/sql/customer-availability-slots.draft.sql, docs/sql/customer-appointment-history.draft.sql e docs/sql/customer-engagement.draft.sql e docs/sql/customer-coupons.draft.sql ainda não foram aplicadas ao Supabase.
- Até aplicar e testar esses rascunhos, a busca pública, consulta de horários e leitura do histórico exibem estado de ativação/erro seguro; não há dados fictícios.
- A interface permite um serviço por reserva; seleção de vários serviços em um único agendamento ainda precisa ser implementada.
- O fluxo de cupom do app da cliente e a tela administrativa de criação/edição no painel estão implementados no código e no SQL draft, mas não funcionam até a migration ser aplicada e testada. Favoritos, notificações internas e preferências remotas também dependem do SQL draft.
- Configuração e teste ponta a ponta de Google/Passkey precisam ser concluídos no ambiente de autenticação.
- Fluxo completo de publicação pelo painel e de reserva pelo app precisa de teste E2E com salão, filial, serviços e profissionais reais.

Nenhuma funcionalidade pendente deve exibir dados fictícios ou afirmar sucesso sem confirmação do backend.
