-- Repetição não reaplica preço/cupom após confirmação original.
CREATE OR REPLACE FUNCTION private.confirm_customer_appointment_hold_with_coupon(p_hold_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_hold public.appointment_holds%rowtype;
  v_appointment_id uuid;
begin
  select * into v_hold from public.appointment_holds h
  where h.id=p_hold_id and h.auth_user_id=v_user for update;
  if not found then raise exception 'Reserva não encontrada para esta conta.' using errcode='42501'; end if;

  -- Repetição da confirmação não sobrescreve o preço nem o histórico posterior.
  if v_hold.status='confirmed' and v_hold.confirmed_appointment_id is not null then
    return v_hold.confirmed_appointment_id;
  end if;

  v_appointment_id:=private.confirm_customer_appointment_hold(p_hold_id);

  if v_hold.coupon_id is not null then
    update public.appointments
       set price=v_hold.coupon_final_amount
     where id=v_appointment_id and org_id=v_hold.org_id;

    update public.customer_coupon_redemptions
       set status='redeemed',appointment_id=v_appointment_id,redeemed_at=now(),updated_at=now()
     where hold_id=v_hold.id and auth_user_id=v_user and status='reserved';
  end if;
  return v_appointment_id;
end;
$function$;
