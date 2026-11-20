-- Move privileged transactional RPC implementations out of the exposed public schema.
-- Public RPC names and parameter defaults remain stable; wrappers execute as INVOKER.
-- Authorization remains inside the private SECURITY DEFINER implementations.

begin;

alter function public.adjust_product_stock(uuid,text,numeric,text,numeric) set schema private;
alter function public.cancel_expense(uuid) set schema private;
alter function public.cancel_service_order(uuid,boolean) set schema private;
alter function public.close_cash_register(uuid,numeric) set schema private;
alter function public.open_cash_register(uuid,numeric) set schema private;
alter function public.pay_expense(uuid,text,boolean) set schema private;
alter function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) set schema private;
alter function public.permanently_delete_recycle_bin_group(uuid) set schema private;
alter function public.refund_service_order(uuid,boolean,text) set schema private;
alter function public.register_cash_movement(uuid,text,numeric,text,text,text) set schema private;
alter function public.register_service_order_payment(uuid,numeric,text) set schema private;
alter function public.restore_recycle_bin_group(uuid) set schema private;
alter function public.revoke_professional_app_access(uuid,uuid) set schema private;
alter function public.set_professional_app_access(uuid,uuid,boolean,text) set schema private;
alter function public.start_appointment_group_service_order(uuid,uuid,boolean) set schema private;
alter function public.start_appointment_service_order(uuid,uuid,boolean) set schema private;

grant usage on schema private to authenticated, service_role;
grant execute on function private.adjust_product_stock(uuid,text,numeric,text,numeric) to authenticated, service_role;
grant execute on function private.cancel_expense(uuid) to authenticated, service_role;
grant execute on function private.cancel_service_order(uuid,boolean) to authenticated, service_role;
grant execute on function private.close_cash_register(uuid,numeric) to authenticated, service_role;
grant execute on function private.open_cash_register(uuid,numeric) to authenticated, service_role;
grant execute on function private.pay_expense(uuid,text,boolean) to authenticated, service_role;
grant execute on function private.pay_professional_commissions(uuid,uuid,uuid[],text,text) to authenticated, service_role;
grant execute on function private.permanently_delete_recycle_bin_group(uuid) to authenticated, service_role;
grant execute on function private.refund_service_order(uuid,boolean,text) to authenticated, service_role;
grant execute on function private.register_cash_movement(uuid,text,numeric,text,text,text) to authenticated, service_role;
grant execute on function private.register_service_order_payment(uuid,numeric,text) to authenticated, service_role;
grant execute on function private.restore_recycle_bin_group(uuid) to authenticated, service_role;
grant execute on function private.revoke_professional_app_access(uuid,uuid) to authenticated, service_role;
grant execute on function private.set_professional_app_access(uuid,uuid,boolean,text) to authenticated, service_role;
grant execute on function private.start_appointment_group_service_order(uuid,uuid,boolean) to authenticated, service_role;
grant execute on function private.start_appointment_service_order(uuid,uuid,boolean) to authenticated, service_role;

create function public.adjust_product_stock(p_product_id uuid,p_movement_type text,p_quantity numeric,p_reason text,p_unit_cost numeric default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.adjust_product_stock($1,$2,$3,$4,$5); $$;
create function public.cancel_expense(p_expense_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.cancel_expense($1); $$;
create function public.cancel_service_order(p_order_id uuid,p_refund_payments boolean default false)
returns jsonb language sql security invoker set search_path=''
as $$ select private.cancel_service_order($1,$2); $$;
create function public.close_cash_register(p_cash_register_id uuid,p_closing_amount numeric)
returns jsonb language sql security invoker set search_path=''
as $$ select private.close_cash_register($1,$2); $$;
create function public.open_cash_register(p_org_id uuid,p_opening_amount numeric)
returns jsonb language sql security invoker set search_path=''
as $$ select private.open_cash_register($1,$2); $$;
create function public.pay_expense(p_expense_id uuid,p_payment_method text,p_use_cash boolean default true)
returns jsonb language sql security invoker set search_path=''
as $$ select private.pay_expense($1,$2,$3); $$;
create function public.pay_professional_commissions(p_org_id uuid,p_professional_id uuid,p_commission_ids uuid[],p_payment_method text,p_notes text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.pay_professional_commissions($1,$2,$3,$4,$5); $$;
create function public.permanently_delete_recycle_bin_group(p_group_id uuid)
returns integer language sql security invoker set search_path=''
as $$ select private.permanently_delete_recycle_bin_group($1); $$;
create function public.refund_service_order(p_order_id uuid,p_return_stock boolean default true,p_reason text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.refund_service_order($1,$2,$3); $$;
create function public.register_cash_movement(p_org_id uuid,p_movement_type text,p_amount numeric,p_payment_method text,p_category text,p_description text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.register_cash_movement($1,$2,$3,$4,$5,$6); $$;
create function public.register_service_order_payment(p_order_id uuid,p_amount numeric,p_payment_method text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.register_service_order_payment($1,$2,$3); $$;
create function public.restore_recycle_bin_group(p_group_id uuid)
returns integer language sql security invoker set search_path=''
as $$ select private.restore_recycle_bin_group($1); $$;
create function public.revoke_professional_app_access(p_org_id uuid,p_professional_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.revoke_professional_app_access($1,$2); $$;
create function public.set_professional_app_access(p_org_id uuid,p_target_user_id uuid,p_enabled boolean,p_scope text default 'calendar_all')
returns jsonb language sql security invoker set search_path=''
as $$ select private.set_professional_app_access($1,$2,$3,$4); $$;
create function public.start_appointment_group_service_order(p_appointment_id uuid,p_existing_order_id uuid default null,p_force_new boolean default false)
returns jsonb language sql security invoker set search_path=''
as $$ select private.start_appointment_group_service_order($1,$2,$3); $$;
create function public.start_appointment_service_order(p_appointment_id uuid,p_existing_order_id uuid default null,p_force_new boolean default false)
returns jsonb language sql security invoker set search_path=''
as $$ select private.start_appointment_service_order($1,$2,$3); $$;

revoke all on function public.adjust_product_stock(uuid,text,numeric,text,numeric) from public, anon;
revoke all on function public.cancel_expense(uuid) from public, anon;
revoke all on function public.cancel_service_order(uuid,boolean) from public, anon;
revoke all on function public.close_cash_register(uuid,numeric) from public, anon;
revoke all on function public.open_cash_register(uuid,numeric) from public, anon;
revoke all on function public.pay_expense(uuid,text,boolean) from public, anon;
revoke all on function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) from public, anon;
revoke all on function public.permanently_delete_recycle_bin_group(uuid) from public, anon;
revoke all on function public.refund_service_order(uuid,boolean,text) from public, anon;
revoke all on function public.register_cash_movement(uuid,text,numeric,text,text,text) from public, anon;
revoke all on function public.register_service_order_payment(uuid,numeric,text) from public, anon;
revoke all on function public.restore_recycle_bin_group(uuid) from public, anon;
revoke all on function public.revoke_professional_app_access(uuid,uuid) from public, anon;
revoke all on function public.set_professional_app_access(uuid,uuid,boolean,text) from public, anon;
revoke all on function public.start_appointment_group_service_order(uuid,uuid,boolean) from public, anon;
revoke all on function public.start_appointment_service_order(uuid,uuid,boolean) from public, anon;

grant execute on function public.adjust_product_stock(uuid,text,numeric,text,numeric) to authenticated, service_role;
grant execute on function public.cancel_expense(uuid) to authenticated, service_role;
grant execute on function public.cancel_service_order(uuid,boolean) to authenticated, service_role;
grant execute on function public.close_cash_register(uuid,numeric) to authenticated, service_role;
grant execute on function public.open_cash_register(uuid,numeric) to authenticated, service_role;
grant execute on function public.pay_expense(uuid,text,boolean) to authenticated, service_role;
grant execute on function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) to authenticated, service_role;
grant execute on function public.permanently_delete_recycle_bin_group(uuid) to authenticated, service_role;
grant execute on function public.refund_service_order(uuid,boolean,text) to authenticated, service_role;
grant execute on function public.register_cash_movement(uuid,text,numeric,text,text,text) to authenticated, service_role;
grant execute on function public.register_service_order_payment(uuid,numeric,text) to authenticated, service_role;
grant execute on function public.restore_recycle_bin_group(uuid) to authenticated, service_role;
grant execute on function public.revoke_professional_app_access(uuid,uuid) to authenticated, service_role;
grant execute on function public.set_professional_app_access(uuid,uuid,boolean,text) to authenticated, service_role;
grant execute on function public.start_appointment_group_service_order(uuid,uuid,boolean) to authenticated, service_role;
grant execute on function public.start_appointment_service_order(uuid,uuid,boolean) to authenticated, service_role;

commit;
