-- SALÃO PREMIUM — privilégio mínimo para RPCs transacionais de HOLD.
-- Aplicada no Supabase conectado em 20/11/2026 (20261120041450).
begin;
alter function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) security definer;
alter function public.confirm_customer_appointment_hold(uuid) security definer;
alter function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) set search_path = '';
alter function public.confirm_customer_appointment_hold(uuid) set search_path = '';
revoke all on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) from public, anon;
revoke all on function public.confirm_customer_appointment_hold(uuid) from public, anon;
grant execute on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.confirm_customer_appointment_hold(uuid) to authenticated;
commit;