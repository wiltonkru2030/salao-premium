# Cupons administrativos e resgate no aplicativo da cliente

**Projeto:** SALÃO PREMIUM  
**Data:** 20/11/2026  
**Migration aplicada:** `20261120065524_customer_coupons_transactional.sql`  
**Migration de hardening:** `20261120065604_restrict_legacy_hold_private_entrypoints.sql`  
**Migration de índices/RLS:** `20261120070111_coupon_fk_indexes_and_public_profile_policy_cleanup.sql`  
**Estado:** estrutura e RPCs implantadas; testes automatizados de contrato e permissões estruturais disponíveis; E2E autenticado com dados de QA ainda pendente.

## Objetivo

Permitir que owner/admin configurem cupons por organização, filial e serviços elegíveis. A cliente autenticada pode consultar uma prévia e aplicar o cupom ao reservar um serviço. O banco calcula novamente o desconto, reserva o uso com o HOLD e aplica o preço final ao agendamento confirmado.

O navegador nunca envia um valor de desconto como fonte de verdade.

## Tabelas

### `salon_coupons`
Armazena campanhas por organização:
- código único por organização, normalizado em maiúsculas;
- título e descrição;
- desconto percentual ou valor fixo;
- teto opcional de desconto;
- valor mínimo do serviço;
- início e fim da validade;
- limite total e limite por cliente;
- filial opcional;
- situação ativa/inativa e autor da criação.

A chave composta `(org_id, branch_id)` valida a filial dentro da organização. O índice único `(org_id, upper(code))` impede códigos duplicados sem diferenciar maiúsculas/minúsculas.

### `salon_coupon_services`
Define serviços elegíveis. Sem linhas para um cupom, ele pode ser usado em qualquer serviço ativo; com linhas, só os serviços mapeados são elegíveis. As FKs compostas preservam o isolamento do tenant.

### `customer_coupon_redemptions`
Mantém a reserva e o resgate:
- identidade autenticada da cliente;
- cupom e HOLD relacionados;
- agendamento confirmado, quando houver;
- preço original, desconto e preço final;
- status `reserved`, `redeemed` ou `released`;
- datas de criação, atualização e resgate.

Índices únicos impedem dois resgates para o mesmo HOLD ou agendamento.

### Campos adicionados a `appointment_holds`
- `coupon_id`: cupom reservado;
- `coupon_discount_amount`: desconto calculado pelo banco;
- `coupon_final_amount`: valor final calculado pelo banco;
- `coupon_code_snapshot`: cópia do código usado, para preservar histórico.

## Segurança

- RLS habilitado nas três tabelas.
- Índices de cobertura para as FKs compostas e para `auth_user_id` nas tabelas de resgate.
- As políticas de leitura/escrita da vitrine foram separadas para não manter SELECT permissivo duplicado.
- Anon não possui SELECT direto nem permissão de escrita.
- Leitura administrativa de cupons e resgates limitada a owner/admin.
- Escrita administrativa feita por RPC privada, que exige `auth.uid()` e `private.has_org_role(org_id, ['owner','admin'])`.
- Wrappers no schema público são `SECURITY INVOKER`; lógica privilegiada permanece em `private`, com `SECURITY DEFINER` e `search_path = ''`.
- As antigas RPCs públicas de HOLD sem cupom foram revogadas para authenticated/anon.
- O acesso direto às implementações privadas antigas de criação, confirmação e cancelamento de HOLD também foi revogado.
- A cliente só pode validar e resgatar cupom com sessão autenticada.
- A auditoria genérica `private.capture_row_audit()` registra alterações nas três tabelas.

## RPCs

### Painel administrativo
- `save_salon_coupon`: cria ou atualiza campanha, valida filial e serviços, substitui mapeamentos e preserva histórico.
- `deactivate_salon_coupon`: desativa sem apagar campanha ou resgates.

### Aplicativo da cliente
- `validate_public_coupon`: prévia sem reservar uso. Exige cliente autenticada.
- `create_customer_appointment_hold_with_coupon`: operação transacional que aceita código ou NULL. Com código, bloqueia a linha do cupom com `FOR UPDATE`, recalcula elegibilidade e limites, cria HOLD e reserva resgate. Sem código, cria HOLD normal e devolve preço original.
- `confirm_customer_appointment_hold_with_coupon`: confirma o HOLD, atualiza `appointments.price` para o valor final e marca o resgate como `redeemed`.
- `cancel_customer_appointment_hold_with_coupon`: cancela HOLD; o trigger libera o resgate.
- `private.release_coupon_reservation_on_hold_end`: libera resgates quando HOLD ativo muda para cancelado ou expirado.

## Regras financeiras e de concorrência

- Desconto percentual é arredondado para duas casas e respeita o teto opcional.
- Desconto fixo não pode ultrapassar o preço do serviço.
- O valor mínimo é comparado com o preço original do serviço.
- O limite total e o limite por cliente contam resgates confirmados e reservas HOLD ainda ativas/não expiradas.
- A validação visual não reserva o cupom; o HOLD revalida tudo no servidor.
- A linha do cupom é bloqueada durante a criação do HOLD para serializar usos concorrentes.
- Se a criação do HOLD ou a gravação do resgate falhar, toda a transação é revertida.
- A confirmação grava o preço final no agendamento; o módulo de Comanda usa `appointments.price` para criar o item de serviço.

## Integração de código

- `src/modules/coupons/coupon.service.js`: leitura, payload, gravação e desativação no painel.
- `cliente/services/couponService.js`: normalização e prévia de cupom.
- `cliente/services/bookingService.js`: criação, confirmação e cancelamento via RPCs transacionais.
- `cliente/services/appointmentHoldService.js`: adaptador do cliente Supabase.
- `cliente/app.js`: validação e aplicação do cupom na jornada visual.
- `cliente/ui/salonDetailView.js`: exibição da prévia, desconto e total.
- `docs/sql/customer-coupons.draft.test.mjs`: testes estáticos do rascunho e das migrations aplicadas.

## Verificações executadas

- Confirmadas as três tabelas e as seis RPCs públicas no Supabase.
- RLS habilitado nas três tabelas; anon sem SELECT direto.
- Wrappers públicos são SECURITY INVOKER; implementações privadas são SECURITY DEFINER.
- Confirmado que anon não executa RPCs de cupons.
- Confirmado que as RPCs antigas públicas de HOLD foram revogadas.
- Confirmado que as implementações privadas antigas de HOLD não são executáveis diretamente por authenticated.
- Confirmado que as funções de gravação validam owner/admin, sem conceder esse poder ao papel manager.
- Migration e hardening registrados no histórico do Supabase.
- Testes automatizados do serviço de cupons administrativo e do serviço de cupom da cliente já fazem parte de `test:all`.

## Pendências antes de produção

1. E2E autenticado com uma organização de QA, dois clientes e dois salões para testar isolamento, concorrência, limite total, limite por cliente, expiração, cancelamento e confirmação.
2. Testar cupom percentual, fixo, teto de desconto, valor mínimo, filial específica e serviços elegíveis.
3. Conferir o valor da comanda e da comissão após aplicar o desconto.
4. Revisar visualmente os estados de cupom inválido, expirado, esgotado, reserva temporária e confirmação em mobile/desktop.
5. A validação automatizada do HEAD atual ainda precisa ser confirmada; não tratar testes estáticos como prova de fluxo E2E.

**Critério de conclusão:** cupom só será considerado pronto para produção após E2E com duas sessões reais, concorrência e reconciliação do valor entre agendamento, comanda, caixa e comissão.
