# Área da Cliente — SALÃO PREMIUM

> Revisão documental: 24/11/2026. Evidências do código e inventário de 20/11; não houve nova consulta ao banco ou execução de testes nesta revisão. Consulte o README mestre.

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
- Central de notificações internas com leitura individual e em lote; o contrato de backend prevê eventos quando agendamentos são criados, confirmados, cancelados, concluídos ou remarcados.
- Sincronização remota de preferências (tema, lembretes, promoções e região), mantendo fallback local quando a RPC estiver indisponível.
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

## Evolução do banco e recursos adicionais

O [inventário de 20/11/2026](../docs/migrations/remote-history-2026-11-20.json) registra 97 versões, incluindo identidade global, HOLD e disponibilidade (20261120041015–20261120041928), diretório público (20261120064407), cupons transacionais (20261120065524 e 20261120163441), histórico (20261120163051), favoritos/preferências (20261120163536), notificações privadas (20261120164053) e fidelidade (20261120213452). Os antigos drafts em docs/sql são referências, não instruções para reaplicação.

- `services/appointmentChangesService.js`: consulta permissões, horários e cancelamento/remarcação, com verificação do início original para detectar concorrência. Verificar RPCs no ambiente.
- `services/loyaltyService.js` e `ui/loyaltyView.js`: indicadores de atendimentos concluídos, comandas pagas e total pago por salão. Não confundir com programa de pontos ou resgates.
- PIN local de quatro dígitos permanece requisito de desbloqueio após Google/Passkey; não enviar ao servidor nem utilizar como login independente. Sem OTP pago por SMS/WhatsApp.
- Sessão isolada do painel e profissional, descarte de respostas antigas, GPS apenas por ação explícita, nenhuma fusão automática por telefone.

## Homologação obrigatória

- Configurar OAuth, redirects, domínio HTTPS e Passkey; testar login, recuperação e troca de conta em dispositivos reais.
- Validar publicação e link por filial, pesquisa/GPS, catálogo, HOLD concorrente, cupom, histórico, cancelamento/remarcação, favoritos, notificações e fidelidade.
- Seleção de múltiplos serviços em uma única reserva e PIN local ainda exigem implementação/validação.
- Validar interface acessível, CSS global, máscaras, loading discreto e mensagens pt-BR.
- Executar test:customer-auth, test:customer-account, test:customer-profile, test:customer-services, test:customer-appointment-changes, test:customer-loyalty e test:sql-customer-applied-migrations via npm run. Executar test:customer-rls somente em QA autorizado com duas identidades e dois tenants.
- Não simular sucesso nem usar dados fictícios. A existência das migrations e testes não comprova a operação real.

Ver [README mestre](../README.md) e [identidade global](../docs/CLIENTE-IDENTIDADE-MARCA.md).
