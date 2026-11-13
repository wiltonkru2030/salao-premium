-- Descrições permanentes para colunas e operações financeiras/agenda.

comment on column public.commissions.service_order_payment_id is
'Recebimento individual que originou esta parcela de comissão; preserva o vínculo e o percentual aplicado.';
comment on column public.service_order_payments.refund_cash_movement_id is
'Movimento de saída no Caixa criado para estornar integralmente este recebimento.';
comment on column public.service_order_payments.refunded_at is
'Data/hora em que o recebimento foi estornado.';
comment on column public.service_order_payments.refunded_by is
'Usuário responsável pelo estorno do recebimento.';
comment on column public.cash_movements.service_order_id is
'Comanda relacionada ao movimento, inclusive para rastrear entradas e estornos.';

comment on function private.accrue_partial_service_order_commissions(uuid,uuid,numeric) is
'Calcula e grava a comissão proporcional aos itens elegíveis de uma parcela recebida. É chamada internamente pela RPC de pagamento; não deve ser executada diretamente pelo cliente.';
comment on function public.register_service_order_payment(uuid,numeric,text) is
'Registra um pagamento total ou parcial da Comanda, exige Caixa aberto, grava entrada no Caixa, gera comissão proporcional e, na quitação, conclui venda e baixa estoque atomicamente.';
comment on function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) is
'Paga lançamentos de comissão selecionados de um profissional, valida organização/itens e registra a saída no Caixa aberto.';
comment on function public.open_cash_register(uuid,numeric) is
'Abre o caixa padrão da organização após validar papel, impedir outra abertura simultânea e registrar o usuário responsável.';
comment on function public.close_cash_register(uuid,numeric) is
'Bloqueia o caixa aberto, calcula o saldo esperado com os movimentos e grava fechamento e diferença de forma transacional.';
comment on function public.start_appointment_group_service_order(uuid,uuid,boolean) is
'Abre todos os agendamentos ativos de um grupo na mesma Comanda em uma única transação; qualquer falha reverte todo o grupo.';
comment on function public.cancel_service_order(uuid,boolean) is
'Cancela Comanda ainda não fechada; se houver pagamentos parciais, exige estorno integral, registra saídas no Caixa e cancela comissões não pagas e agendamentos relacionados.';

