-- SALÃO PREMIUM — fechar acesso direto às implementações antigas de HOLD.
-- As reservas do cliente agora passam exclusivamente pelos wrappers coupon-aware,
-- que validam publicação, preço e resgate. As funções base permanecem privadas
-- e são chamadas internamente pelas funções SECURITY DEFINER novas.

begin;

revoke all on function private.create_customer_appointment_hold(
  uuid,uuid,uuid,uuid,timestamptz
) from public,anon,authenticated;
revoke all on function private.confirm_customer_appointment_hold(uuid)
  from public,anon,authenticated;
revoke all on function private.cancel_customer_appointment_hold(uuid)
  from public,anon,authenticated;

commit;
