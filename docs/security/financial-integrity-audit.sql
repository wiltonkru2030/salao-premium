-- Auditoria financeira somente leitura; não modifica dados.
WITH payments AS (SELECT org_id,order_id,sum(amount) FILTER (WHERE status='confirmed') confirmed FROM public.service_order_payments GROUP BY org_id,order_id), bases AS (SELECT org_id,service_order_item_id,sum(base_amount) accrued FROM public.commissions WHERE service_order_item_id IS NOT NULL AND service_order_payment_id IS NOT NULL AND status<>'cancelled' GROUP BY org_id,service_order_item_id)
SELECT 'overpaid_orders' check_name,count(*) findings FROM public.service_orders o JOIN payments p ON p.org_id=o.org_id AND p.order_id=o.id WHERE p.confirmed>o.total
UNION ALL SELECT 'commission_base_over_item_total',count(*) FROM bases b JOIN public.service_order_items i ON i.org_id=b.org_id AND i.id=b.service_order_item_id WHERE b.accrued>i.total+0.01
UNION ALL SELECT 'paid_commissions_without_payout',count(*) FROM public.commissions WHERE status='paid' AND payout_id IS NULL
UNION ALL SELECT 'payout_amount_mismatch',count(*) FROM public.commission_payouts p WHERE abs(p.amount-coalesce((SELECT sum(i.amount) FROM public.commission_payout_items i WHERE i.org_id=p.org_id AND i.payout_id=p.id),0))>0.01;
