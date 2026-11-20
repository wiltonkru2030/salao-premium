-- RASCUNHO — hardening de RPCs públicas SECURITY DEFINER do SALÃO PREMIUM.
-- Move a implementação privilegiada para schema private e mantém wrappers públicos SECURITY INVOKER.
-- Exclui pay_professional_commissions/refund_service_order, cobertas pelo rascunho de estorno de comissões.
-- Não aplicar em produção sem revisão, teste em projeto isolado e autorização explícita.

begin;

grant usage on schema private to authenticated,service_role;

-- adjust_product_stock: implementação original preservada; endpoint público passa a ser invoker.
alter function public.adjust_product_stock(uuid, text, numeric, text, numeric) set schema private;
revoke all on function private.adjust_product_stock(uuid, text, numeric, text, numeric) from public,anon,authenticated;
grant execute on function private.adjust_product_stock(uuid, text, numeric, text, numeric) to authenticated,service_role;
create or replace function public.adjust_product_stock(p_product_id uuid, p_movement_type text, p_quantity numeric, p_reason text, p_unit_cost numeric DEFAULT NULL::numeric)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.adjust_product_stock($1, $2, $3, $4, $5);
$function$;
revoke all on function public.adjust_product_stock(uuid, text, numeric, text, numeric) from public,anon,authenticated;
grant execute on function public.adjust_product_stock(uuid, text, numeric, text, numeric) to authenticated,service_role;

-- cancel_expense: implementação original preservada; endpoint público passa a ser invoker.
alter function public.cancel_expense(uuid) set schema private;
revoke all on function private.cancel_expense(uuid) from public,anon,authenticated;
grant execute on function private.cancel_expense(uuid) to authenticated,service_role;
create or replace function public.cancel_expense(p_expense_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.cancel_expense($1);
$function$;
revoke all on function public.cancel_expense(uuid) from public,anon,authenticated;
grant execute on function public.cancel_expense(uuid) to authenticated,service_role;

-- cancel_service_order: implementação original preservada; endpoint público passa a ser invoker.
alter function public.cancel_service_order(uuid, boolean) set schema private;
revoke all on function private.cancel_service_order(uuid, boolean) from public,anon,authenticated;
grant execute on function private.cancel_service_order(uuid, boolean) to authenticated,service_role;
create or replace function public.cancel_service_order(p_order_id uuid, p_refund_payments boolean DEFAULT false)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.cancel_service_order($1, $2);
$function$;
revoke all on function public.cancel_service_order(uuid, boolean) from public,anon,authenticated;
grant execute on function public.cancel_service_order(uuid, boolean) to authenticated,service_role;

-- close_cash_register: implementação original preservada; endpoint público passa a ser invoker.
alter function public.close_cash_register(uuid, numeric) set schema private;
revoke all on function private.close_cash_register(uuid, numeric) from public,anon,authenticated;
grant execute on function private.close_cash_register(uuid, numeric) to authenticated,service_role;
create or replace function public.close_cash_register(p_cash_register_id uuid, p_closing_amount numeric)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.close_cash_register($1, $2);
$function$;
revoke all on function public.close_cash_register(uuid, numeric) from public,anon,authenticated;
grant execute on function public.close_cash_register(uuid, numeric) to authenticated,service_role;

-- open_cash_register: implementação original preservada; endpoint público passa a ser invoker.
alter function public.open_cash_register(uuid, numeric) set schema private;
revoke all on function private.open_cash_register(uuid, numeric) from public,anon,authenticated;
grant execute on function private.open_cash_register(uuid, numeric) to authenticated,service_role;
create or replace function public.open_cash_register(p_org_id uuid, p_opening_amount numeric)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.open_cash_register($1, $2);
$function$;
revoke all on function public.open_cash_register(uuid, numeric) from public,anon,authenticated;
grant execute on function public.open_cash_register(uuid, numeric) to authenticated,service_role;

-- pay_expense: implementação original preservada; endpoint público passa a ser invoker.
alter function public.pay_expense(uuid, text, boolean) set schema private;
revoke all on function private.pay_expense(uuid, text, boolean) from public,anon,authenticated;
grant execute on function private.pay_expense(uuid, text, boolean) to authenticated,service_role;
create or replace function public.pay_expense(p_expense_id uuid, p_payment_method text, p_use_cash boolean DEFAULT true)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.pay_expense($1, $2, $3);
$function$;
revoke all on function public.pay_expense(uuid, text, boolean) from public,anon,authenticated;
grant execute on function public.pay_expense(uuid, text, boolean) to authenticated,service_role;

-- permanently_delete_recycle_bin_group: implementação original preservada; endpoint público passa a ser invoker.
alter function public.permanently_delete_recycle_bin_group(uuid) set schema private;
revoke all on function private.permanently_delete_recycle_bin_group(uuid) from public,anon,authenticated;
grant execute on function private.permanently_delete_recycle_bin_group(uuid) to authenticated,service_role;
create or replace function public.permanently_delete_recycle_bin_group(p_group_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $function$
  select private.permanently_delete_recycle_bin_group($1);
$function$;
revoke all on function public.permanently_delete_recycle_bin_group(uuid) from public,anon,authenticated;
grant execute on function public.permanently_delete_recycle_bin_group(uuid) to authenticated,service_role;

-- register_cash_movement: implementação original preservada; endpoint público passa a ser invoker.
alter function public.register_cash_movement(uuid, text, numeric, text, text, text) set schema private;
revoke all on function private.register_cash_movement(uuid, text, numeric, text, text, text) from public,anon,authenticated;
grant execute on function private.register_cash_movement(uuid, text, numeric, text, text, text) to authenticated,service_role;
create or replace function public.register_cash_movement(p_org_id uuid, p_movement_type text, p_amount numeric, p_payment_method text, p_category text, p_description text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.register_cash_movement($1, $2, $3, $4, $5, $6);
$function$;
revoke all on function public.register_cash_movement(uuid, text, numeric, text, text, text) from public,anon,authenticated;
grant execute on function public.register_cash_movement(uuid, text, numeric, text, text, text) to authenticated,service_role;

-- register_service_order_payment: implementação original preservada; endpoint público passa a ser invoker.
alter function public.register_service_order_payment(uuid, numeric, text) set schema private;
revoke all on function private.register_service_order_payment(uuid, numeric, text) from public,anon,authenticated;
grant execute on function private.register_service_order_payment(uuid, numeric, text) to authenticated,service_role;
create or replace function public.register_service_order_payment(p_order_id uuid, p_amount numeric, p_payment_method text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.register_service_order_payment($1, $2, $3);
$function$;
revoke all on function public.register_service_order_payment(uuid, numeric, text) from public,anon,authenticated;
grant execute on function public.register_service_order_payment(uuid, numeric, text) to authenticated,service_role;

-- restore_recycle_bin_group: implementação original preservada; endpoint público passa a ser invoker.
alter function public.restore_recycle_bin_group(uuid) set schema private;
revoke all on function private.restore_recycle_bin_group(uuid) from public,anon,authenticated;
grant execute on function private.restore_recycle_bin_group(uuid) to authenticated,service_role;
create or replace function public.restore_recycle_bin_group(p_group_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $function$
  select private.restore_recycle_bin_group($1);
$function$;
revoke all on function public.restore_recycle_bin_group(uuid) from public,anon,authenticated;
grant execute on function public.restore_recycle_bin_group(uuid) to authenticated,service_role;

-- revoke_professional_app_access: implementação original preservada; endpoint público passa a ser invoker.
alter function public.revoke_professional_app_access(uuid, uuid) set schema private;
revoke all on function private.revoke_professional_app_access(uuid, uuid) from public,anon,authenticated;
grant execute on function private.revoke_professional_app_access(uuid, uuid) to authenticated,service_role;
create or replace function public.revoke_professional_app_access(p_org_id uuid, p_professional_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.revoke_professional_app_access($1, $2);
$function$;
revoke all on function public.revoke_professional_app_access(uuid, uuid) from public,anon,authenticated;
grant execute on function public.revoke_professional_app_access(uuid, uuid) to authenticated,service_role;

-- set_professional_app_access: implementação original preservada; endpoint público passa a ser invoker.
alter function public.set_professional_app_access(uuid, uuid, boolean, text) set schema private;
revoke all on function private.set_professional_app_access(uuid, uuid, boolean, text) from public,anon,authenticated;
grant execute on function private.set_professional_app_access(uuid, uuid, boolean, text) to authenticated,service_role;
create or replace function public.set_professional_app_access(p_org_id uuid, p_target_user_id uuid, p_enabled boolean, p_scope text DEFAULT 'calendar_all'::text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.set_professional_app_access($1, $2, $3, $4);
$function$;
revoke all on function public.set_professional_app_access(uuid, uuid, boolean, text) from public,anon,authenticated;
grant execute on function public.set_professional_app_access(uuid, uuid, boolean, text) to authenticated,service_role;

-- start_appointment_group_service_order: implementação original preservada; endpoint público passa a ser invoker.
alter function public.start_appointment_group_service_order(uuid, uuid, boolean) set schema private;
revoke all on function private.start_appointment_group_service_order(uuid, uuid, boolean) from public,anon,authenticated;
grant execute on function private.start_appointment_group_service_order(uuid, uuid, boolean) to authenticated,service_role;
create or replace function public.start_appointment_group_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.start_appointment_group_service_order($1, $2, $3);
$function$;
revoke all on function public.start_appointment_group_service_order(uuid, uuid, boolean) from public,anon,authenticated;
grant execute on function public.start_appointment_group_service_order(uuid, uuid, boolean) to authenticated,service_role;

-- start_appointment_service_order: implementação original preservada; endpoint público passa a ser invoker.
alter function public.start_appointment_service_order(uuid, uuid, boolean) set schema private;
revoke all on function private.start_appointment_service_order(uuid, uuid, boolean) from public,anon,authenticated;
grant execute on function private.start_appointment_service_order(uuid, uuid, boolean) to authenticated,service_role;
create or replace function public.start_appointment_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.start_appointment_service_order($1, $2, $3);
$function$;
revoke all on function public.start_appointment_service_order(uuid, uuid, boolean) from public,anon,authenticated;
grant execute on function public.start_appointment_service_order(uuid, uuid, boolean) to authenticated,service_role;

commit;
