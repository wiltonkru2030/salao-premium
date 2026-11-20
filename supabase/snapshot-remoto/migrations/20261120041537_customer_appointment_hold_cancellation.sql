-- Permite cancelar apenas o HOLD pertencente à identidade autenticada.
begin;
create or replace function public.cancel_customer_appointment_hold(p_hold_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_rows integer;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para cancelar a reserva.' using errcode = '42501';
  end if;
  if p_hold_id is null then
    raise exception 'Reserva temporária inválida.' using errcode = '22023';
  end if;

  update public.appointment_holds
     set status = 'cancelled', updated_at = now()
   where id = p_hold_id
     and auth_user_id = v_user
     and status = 'active'
     and expires_at > now();

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.cancel_customer_appointment_hold(uuid) from public, anon, authenticated;
grant execute on function public.cancel_customer_appointment_hold(uuid) to authenticated;
commit;