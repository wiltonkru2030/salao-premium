# Plano de revisão e aplicação de SQL — SALÃO PREMIUM

## Regra de segurança
Os arquivos marcados como draft são documentos de revisão, não migrations aplicadas. Nenhum deles deve ser executado em produção sem:
1. revisão de schema, grants, RLS e funções;
2. aplicação em projeto Supabase de teste;
3. execução dos testes de integração com dados descartáveis;
4. validação do painel, app da cliente e app profissional;
5. autorização explícita para produção e plano de rollback.

## Diretório e app da cliente
1. docs/sql/customer-public-directory.draft.sql — perfis públicos do salão e filiais, RLS, busca, catálogo e gravação owner/admin.
2. docs/sql/customer-availability-slots.draft.sql — consulta de horários, limitada a salões e unidades publicados.
3. docs/sql/audit-composite-record-identifiers.draft.sql — complementa auditoria e lixeira das tabelas globais e chaves compostas; depende das tabelas de identidade global já aplicadas.
4. docs/sql/customer-appointment-history.draft.sql — histórico da própria identidade global autenticada.
5. docs/sql/customer-engagement.draft.sql — favoritos, notificações internas por trigger e preferências globais.
6. docs/sql/customer-coupons.draft.sql — gestão de cupons, validação, reserva transacional no HOLD e resgate na confirmação.

A etapa 1 é pré-requisito das etapas 2, 5 e 6. As etapas 3 e 4 dependem das migrations de identidade global já aplicadas. A etapa 6 depende também de appointments, appointment_holds e serviços ativos.

## Comissões
1. supabase/migrations/20261119170000_snapshot_commission_rate_on_first_payment.sql — congela a regra de comissão no primeiro pagamento do item. Está versionada, mas não consta no histórico do Supabase conectado.
2. docs/sql/commission-refund-reversals.draft.sql — débito de comissões já pagas, compensação automática no próximo repasse e wrappers SECURITY INVOKER. Ainda não aplicada.

O rascunho de reversão pressupõe as tabelas atuais de comissões e repasses. Deve ser testado com pagamentos parciais, comissão já paga, estorno total e repasse líquido.

## Hardening de RPCs
- docs/sql/security-definer-api-hardening.draft.sql — move 14 implementações SECURITY DEFINER do schema public para private, mantendo contratos PostgREST em wrappers SECURITY INVOKER.
- O rascunho de estorno também migra pay_professional_commissions e refund_service_order. Os dois rascunhos devem ser revisados em conjunto para não criar funções duplicadas.
- O hardening preserva execução para authenticated e service_role, mas não concede acesso a anon.
- Confirmar que private não está na lista de schemas expostos pela API.

## Auditoria global
- docs/sql/audit-composite-record-identifiers.draft.sql — atualiza a função de auditoria para registrar identificadores de chaves compostas e instala gatilhos nas tabelas de identidade global. Ainda não aplicada.

## Não incluído nesta etapa
- Definir faixas de comissão progressiva por meta/período, se o negócio realmente exigir faixas variáveis.
- Aplicar os rascunhos em produção.
- Envio de notificações push, e-mail ou WhatsApp.
