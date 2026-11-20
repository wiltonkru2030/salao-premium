-- Implementações privilegiadas de HOLD ficam em private.
-- O schema public expõe somente wrappers SECURITY INVOKER autenticados.
begin;
alter function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) set schema private;
alter function public.confirm_customer_appointment_hold(uuid) set schema private;
alter function public.cancel_customer_appointment_hold(uuid) set schema private;

revoke all on function private.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) from public, anon;
revoke all on function private.confirm_customer_appointment_hold(uuid) from public, anon;
revoke all on function private.cancel_customer_appointment_hold(uuid) from public, anon;
grant execute on function private.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function private.confirm_customer_appointment_hold(uuid) to authenticated;
grant execute on function private.cancel_customer_appointment_hold(uuid) to authenticated;

create function public.create_customer_appointment_hold(
 p_org_id uuid,p_branch_id uuid,p_professional_id uuid,p_service_id uuid,p_starts_at timestamptz
) returns table(hold_id uuid,expires_at timestamptz)
language sql security invoker set search_path=''
as $function$
 select * from private.create_customer_appointment_hold(
 p_org_id,p_branch_id,p_professional_id,p_service_id,p_starts_at);
$function$;

create function public.confirm_customer_appointment_hold(p_hold_id uuid)
returns uuid language sql security invoker set search_path=''
as $function$
 select private.confirm_customer_appointment_hold(p_hold_id);
$function$;

create function public.cancel_customer_appointment_hold(p_hold_id uuid)
returns boolean language sql security invoker set search_path=''
as $function$
 select private.cancel_customer_appointment_hold(p_hold_id);
$function$;

revoke all on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.confirm_customer_appointment_hold(uuid) from public,anon,authenticated;
revoke all on function public.cancel_customer_appointment_hold(uuid) from public,anon,authenticated;
grant execute on function public.create_customer_appointment_hold(uuid,uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.confirm_customer_appointment_hold(uuid) to authenticated;
grant execute on function public.cancel_customer_appointment_hold(uuid) to authenticated;
commit;