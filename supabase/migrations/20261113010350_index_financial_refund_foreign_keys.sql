-- Indexes de apoio às novas chaves estrangeiras do ledger financeiro.
create index if not exists commissions_service_order_payment_idx
  on public.commissions(service_order_payment_id)
  where service_order_payment_id is not null;
create index if not exists service_order_payments_refund_cash_movement_idx
  on public.service_order_payments(refund_cash_movement_id)
  where refund_cash_movement_id is not null;
create index if not exists service_order_payments_refunded_by_idx
  on public.service_order_payments(refunded_by)
  where refunded_by is not null;
