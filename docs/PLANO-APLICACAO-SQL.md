# Plano de revisão e aplicação de SQL — SALÃO PREMIUM

## Regra de segurança
Os arquivos marcados como draft são documentos de revisão, não migrations aplicadas. Nenhum deles deve ser executado em produção sem:
1. revisão de schema, grants, RLS e funções;
2. aplicação em projeto Supabase de teste;
3. execução dos testes de integração com dados descartáveis;
4. validação do painel, app da cliente e app profissional;
5. autorização explícita para produção e plano de rollback.

## Diretório e app da cliente
1. docs/sql/customer-public-directory.draft.sql — tabelas de perfil público e filial, RLS, busca, catálogo e gravação owner/admin.
2. docs/sql/customer-availability-slots.draft.sql — consulta de horários, limitada a salões e unidades publicados.
3. docs/sql/customer-appointment-history.draft.sql — histórico da própria identidade global.
4. docs/sql/customer-engagement.draft.sql — favoritos, notificações internas por trigger e preferências globais.

A etapa 1 é dependência das etapas 2 e 4. O histórico depende das tabelas de identidade global já existentes no ambiente.

## Comissões
1. supabase/migrations/20261119170000_snapshot_commission_rate_on_first_payment.sql — congela a regra de comissão no primeiro pagamento do item.
2. docs/sql/commission-refund-reversals.draft.sql — débito de comissões já pagas, compensação automática no próximo repasse e wrappers SECURITY INVOKER.

O rascunho de reversão pressupõe as tabelas atuais de comissões e repasses. Deve ser testado com pagamentos parciais, comissão já paga, estorno total e repasse líquido.

## Não incluído nesta etapa
- Aplicar SQL em produção.
- Criar regras progressivas de comissão sem definição de faixas, período de apuração e reinício.
- Resgate de cupons com reserva transacional ligada ao HOLD.
- Envio de notificações push, e-mail ou WhatsApp.
