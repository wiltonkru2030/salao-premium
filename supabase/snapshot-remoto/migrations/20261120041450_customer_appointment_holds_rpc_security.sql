-- SECURITY FIX: public booking RPCs must insert protected rows under a narrow,
-- audited SECURITY DEFINER boundary. Both functions verify auth.uid() internally.
begin;

alter function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)
  security definer;
alter function public.confirm_customer_appointment_hold(uuid)
  security definer;

alter function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)
  set search_path = '';
alter function public.confirm_customer_appointment_hold(uuid)
  set search_path = '';

revoke all on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)
  from public, anon;
revoke all on function public.confirm_customer_appointment_hold(uuid)
  from public, anon;
grant execute on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz)
  to authenticated;
grant execute on function public.confirm_customer_appointment_hold(uuid)
  to authenticated;

commit;