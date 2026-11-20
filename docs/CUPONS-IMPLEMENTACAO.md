# Cupons — fluxo e estado de implementação

## Painel do salão
- Página administrativa src/pages/coupons.js, disponível no menu Cupons.
- Formulário em modal: código, título, descrição, percentual/valor fixo, desconto máximo, valor mínimo, filial, serviços elegíveis, validade, limite total e limite por cliente.
- Somente owner/admin vê os controles; RLS e RPC repetem a autorização.
- Salvar usa save_salon_coupon, que grava cupom e serviços elegíveis em uma transação.
- Desativar preserva o histórico de resgates.

## App da cliente
- A cliente informa o código na página pública do salão.
- validate_public_coupon valida filial, serviço, validade, mínimo e limites e devolve uma prévia.
- Ao reservar o horário, create_customer_appointment_hold_with_coupon bloqueia a linha do cupom, recalcula o desconto e cria HOLD + reserva de uso na mesma transação.
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

## Limites atuais
- Um cupom é aplicado a um serviço por HOLD. Reserva com vários serviços e rateio entre itens ainda não estão cobertos.
- O cupom consumido permanece como resgatado mesmo se o atendimento for cancelado posteriormente; política de devolução de cupom precisa de regra comercial explícita.
- A página e os serviços estão no repositório, mas docs/sql/customer-coupons.draft.sql ainda não foi aplicado ao Supabase. O fluxo não deve ser anunciado como ativo antes de aplicar e testar o SQL em ambiente de teste.
- Testes automatizados validam serviço e contrato; falta QA visual e teste transacional real no Supabase de teste.
