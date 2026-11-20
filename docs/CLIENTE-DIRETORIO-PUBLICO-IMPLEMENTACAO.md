# Diretório público, catálogo e reservas da cliente

**Projeto:** SALÃO PREMIUM  
**Data da implementação:** 20/11/2026  
**Branch:** `sync/lovable-finalization-20261113`  
**Estado:** backend de publicação, busca, catálogo e consulta de horários implantado; integração de reservas sem cupom conectada; validação E2E real ainda pendente.

## Objetivo

Permitir que cada salão decida explicitamente se deseja aparecer no aplicativo da cliente e publique cada filial separadamente. A cliente deve conseguir pesquisar unidades publicadas, abrir o catálogo e consultar horários candidatos sem acesso direto às tabelas operacionais privadas.

## Migrations aplicadas

1. `20261120070000_public_salon_directory_and_availability.sql`
   - Primeira versão da estrutura de publicação e das RPCs públicas.
   - Criou a estrutura inicial `public_branch_profiles` e as consultas de diretório, catálogo e disponibilidade.
2. `20261120071000_align_public_profiles_with_settings.sql`
   - Alinhou o banco ao formulário de Configurações que já existia no painel.
   - Substituiu a estrutura inicial pelas tabelas `salon_public_profiles` e `branch_public_profiles`.
   - Criou a RPC transacional `save_public_salon_profile`.
   - Atualizou busca, catálogo e disponibilidade para exigir publicação da marca e da filial.
3. `20261120072000_restrict_private_schema_public_api.sql`
   - Concedeu USAGE no schema privado a `anon` apenas para que wrappers públicos invoker chamem suas implementações internas.
   - Revogou EXECUTE herdado de PUBLIC nas funções privadas e preservou os privilégios previamente efetivos de `authenticated`.
   - Liberou a execução anônima somente para as consultas privadas de busca, catálogo e horários.
4. `20261120073000_allow_members_read_public_profile_settings.sql`
   - Permitiu que membros ativos da organização leiam as configurações da vitrine em modo de consulta.
   - Escrita continua restrita a owner/admin.

## Modelo de dados

### `salon_public_profiles`

Um registro por organização/marca:
- `org_id`: organização proprietária.
- `slug`: endereço público único da marca.
- `display_name`, `description`: nome e descrição divulgados.
- `logo_url`, `cover_image_url`: links HTTPS opcionais.
- `public_phone`, `website_url`, `instagram_url`: contatos divulgados.
- `is_published`: autorização explícita para publicar a marca.

### `branch_public_profiles`

Um registro por filial:
- `org_id`, `branch_id`: chave composta da unidade.
- `public_address`, `neighborhood`, `city`, `state`, `postal_code`: endereço que o salão decidiu divulgar.
- `public_phone`: telefone público específico da filial.
- `latitude`, `longitude`: coordenadas opcionais, obrigatoriamente informadas em par.
- `is_published`: autorização explícita para publicar a unidade.

O endereço privado armazenado em `branches.address` não é copiado automaticamente para a vitrine. A publicação exige que a marca e a filial estejam marcadas como publicadas e que a filial esteja ativa.

## Segurança e autorização

- RLS habilitado nas duas tabelas.
- Anon não possui SELECT direto nas tabelas.
- Membros ativos podem ler as configurações para abrir a tela em modo de consulta.
- Apenas owner/admin pode gravar, validado pela RPC privada com `auth.uid()` e `private.has_org_role`.
- O navegador chama wrappers públicos `SECURITY INVOKER`; as funções privilegiadas ficam no schema `private`, com `SECURITY DEFINER` e `search_path = ''`.
- A busca pública retorna apenas unidades com publicação explícita, sem telefone/e-mail/documento privado da organização.
- A disponibilidade retorna somente horário, identificador e nome do profissional que atende o serviço.
- A disponibilidade não cria reserva. O HOLD continua revalidando as regras no banco para evitar corrida entre consulta e reserva.

## Contratos das RPCs

### `save_public_salon_profile`

Chamada pelo formulário existente em `src/pages/settings.js`. Salva o perfil da marca e o perfil da filial na mesma transação, valida URL HTTPS, slug, cidade/UF e coordenadas, e grava auditoria em `audit_logs`.

### `search_public_salons`

Filtros: texto, cidade, UF, latitude/longitude, raio e limite. Retorna unidades publicadas, distância aproximada quando as coordenadas são fornecidas e dados públicos da filial.

### `get_public_salon_catalog`

Recebe slug da marca e, opcionalmente, filial. Retorna somente serviços ativos e profissionais ativos vinculados ao serviço e compatíveis com a filial publicada.

### `get_customer_available_slots`

Recebe organização, filial, serviço, data, profissional opcional e intervalo de consulta. Usa o fuso de `organizations.timezone` e cruza:
- expediente da filial;
- expediente do profissional;
- duração cadastrada do serviço;
- agendamentos que não estejam cancelados ou como falta;
- bloqueios da agenda;
- HOLDs ativos e não expirados;
- fechamentos da filial;
- afastamentos do profissional.

A lista é uma fotografia da disponibilidade no momento da consulta. A criação do HOLD é a validação transacional definitiva.

## Integração da aplicação

- `cliente/services/salonDirectoryService.js`: busca e catálogo por RPC.
- `cliente/services/bookingService.js`: consulta horários e cria/cancela/confirma HOLDs.
- `cliente/services/appointmentHoldService.js`: injeta o cliente Supabase na camada de serviço.
- `cliente/app.js`: conecta busca, abertura de vitrine, consulta de horários e fluxo de reserva.
- `cliente/ui/homeView.js`: exibe resultados reais, sem salões ou avaliações fictícias.
- `cliente/ui/salonDetailView.js`: exibe catálogo, profissionais, horários e resumo da reserva.
- `src/pages/settings.js`: formulário administrativo existente de publicação da marca e da filial.

**Reserva sem cupom:** foi corrigida para chamar as RPCs base já existentes `create_customer_appointment_hold`, `confirm_customer_appointment_hold` e `cancel_customer_appointment_hold`. O resumo utiliza o preço do catálogo enquanto a RPC base não retorna valores financeiros.

## Pendências explícitas

1. O backend de cupons ainda não está implantado no Supabase: faltam `salon_coupons`, `salon_coupon_services`, `customer_coupon_redemptions` e as RPCs de validação, gravação e reserva com cupom. Portanto, **não considerar cupons funcionais**.
2. A integração de reserva com cupom ainda depende dessas RPCs.
3. Ainda não foi executado um E2E autenticado com uma organização de QA, duas filiais, profissionais, serviços e horários reais.
4. A consulta de disponibilidade foi validada por presença de RPCs, grants e smoke test sem dados publicados; não foi possível comprovar o cálculo com uma agenda real de QA nesta etapa.
5. O painel deve ser testado com owner, admin, gerente e profissional para confirmar o comportamento de leitura da vitrine e escrita restrita.
6. A configuração de localização depende de o salão preencher latitude e longitude; sem coordenadas, a busca por distância não lista aquela unidade quando a cliente usa geolocalização.
7. O fluxo de publicação ainda precisa de teste visual mobile/desktop e revisão de conteúdo/links públicos.

## Verificações executadas nesta etapa

- Migration de diretório aplicada e registrada no Supabase.
- Migration de alinhamento com Configurações aplicada e registrada.
- Migration de grants mínimos aplicada e registrada.
- Migration de leitura por membros aplicada e registrada.
- Confirmada existência das tabelas `salon_public_profiles` e `branch_public_profiles`.
- Confirmada ausência da tabela provisória `public_branch_profiles`.
- Confirmadas as RPCs públicas `save_public_salon_profile`, `search_public_salons`, `get_public_salon_catalog` e `get_customer_available_slots`.
- Confirmado RLS habilitado nas duas tabelas de publicação.
- Confirmado que anon não possui SELECT direto nas tabelas nem execução da RPC de gravação.
- Confirmado que wrappers públicos são SECURITY INVOKER e implementações internas de leitura ficam em `private`.
- Smoke test sob role `anon` executou a busca e catálogo sem erro de permissão após ajustar USAGE/EXECUTE do schema privado.
- Security Advisor continua apontando 16 funções SECURITY DEFINER preexistentes em `public`; não foram alteradas em lote nesta etapa.

**Critério de conclusão:** a vitrine só será considerada pronta após testes E2E com dados de QA, revisão de autorização com múltiplos papéis e confirmação de que o fluxo completo da cliente funciona sem cupons e, depois, com cupons.
