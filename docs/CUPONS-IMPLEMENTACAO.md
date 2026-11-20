# Cupons — fluxo e estado de implementação

## Estado verificado no Supabase conectado
As migrations abaixo constam no histórico do projeto e as tabelas/RPCs foram confirmadas no schema:

- 20261120065524 — customer_coupons_transactional
- 20261120065604 — restrict_legacy_hold_private_entrypoints
- 20261120070111 — coupon_fk_indexes_and_public_profile_policy_cleanup

Tabelas confirmadas: salon_coupons, salon_coupon_services e customer_coupon_redemptions.
RPCs públicas confirmadas como SECURITY INVOKER: save_salon_coupon, deactivate_salon_coupon, validate_public_coupon, create_customer_appointment_hold_with_coupon, confirm_customer_appointment_hold_with_coupon e cancel_customer_appointment_hold_with_coupon.
As implementações privilegiadas ficam em private. As RPCs antigas de criação, confirmação e cancelamento de HOLD foram restringidas; a jornada usa os wrappers coupon-aware mesmo quando não há cupom.

## Painel do salão
- Página administrativa src/pages/coupons.js, disponível no menu Cupons.
- Formulário em modal: código, título, descrição, percentual/valor fixo, desconto máximo, valor mínimo, filial, serviços elegíveis, validade, limite total e limite por cliente.
- Somente owner/admin vê os controles; RLS e RPC repetem a autorização.
- Salvar usa save_salon_coupon, que grava cupom e serviços elegíveis em uma transação.
- Desativar preserva o histórico de resgates.
- O serviço administrativo faz paginação para não truncar o histórico.

## App da cliente
- A cliente informa o código na página pública do salão.
- validate_public_coupon valida filial, serviço, validade, mínimo e limites e devolve uma prévia.
- Ao reservar o horário, create_customer_appointment_hold_with_coupon bloqueia a linha do cupom, recalcula o desconto e cria HOLD + reserva de uso na mesma transação.
- A mesma RPC é usada sem cupom e retorna o preço calculado pelo servidor.
- HOLD cancelado/expirado libera a reserva.
- A confirmação aplica o preço final ao agendamento e marca o resgate como utilizado.
- O backend recalcula os valores; o navegador nunca é fonte de verdade do desconto.

## Regras cobertas
- Percentual ou valor fixo.
- Teto de desconto e valor mínimo.
- Todas as unidades ou uma filial.
- Todos os serviços ou lista de serviços elegíveis.
- Período de validade.
- Limite total e limite por cliente.
- Uma reserva ativa por uso; reserva expirada não consome limite.
- Histórico de resgates não é apagado ao desativar o cupom.
- Auditoria de criação, edição e exclusão com gatilhos para as tabelas operacionais.

## Limites atuais
- Um cupom é aplicado a um serviço por HOLD. Reserva com vários serviços e rateio entre itens ainda não estão cobertos.
- O cupom consumido permanece como resgatado mesmo se o atendimento for cancelado posteriormente; a política de devolução de cupom precisa de regra comercial explícita.
- As migrations foram aplicadas e as tabelas/RPCs foram verificadas, mas ainda falta QA ponta a ponta com conta real de cliente, owner/admin, concorrência entre HOLDs e uso simultâneo do último resgate.
- O SQL em docs/sql/customer-coupons.draft.sql é histórico/supersedido pelas migrations oficiais. Não executar esse rascunho novamente.
