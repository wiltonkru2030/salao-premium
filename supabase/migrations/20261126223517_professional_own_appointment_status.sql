-- Confirma ou cancela agendamentos individuais pelo próprio profissional.
-- A transição é limitada no banco e retorna somente os campos alterados.
create or replace function private.set_own_appointment_status(
  target_org uuid, target_appointment uuid, next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  professional uuid := private.current_professional_id(target_org);
  saved record;
begin
  if professional is null then
    raise exception 'Acesso profissional indisponível.' using errcode = '42501';
  end if;
  if next_status is null or next_status not in ('confirmed', 'cancelled') then
    raise exception 'Situação inválida para esta ação.' using errcode = '22023';
  end if;

  update public.appointments
  set status = next_status,
      cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end
  where org_id = target_org and id = target_appointment and professional_id = professional
    and appointment_group_id is null and service_order_id is null
    and (status = 'scheduled' or (status = 'confirmed' and next_status = 'cancelled'))
  returning id, status into saved;

  if not found then
    raise exception 'O agendamento não está disponível para esta alteração.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', saved.id, 'status', saved.status);
end;
$function$;

create or replace function public.set_own_appointment_status(
  target_org uuid, target_appointment uuid, next_status text
)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.set_own_appointment_status(target_org, target_appointment, next_status);
$function$;

revoke all on function private.set_own_appointment_status(uuid, uuid, text) from public, anon;
revoke all on function public.set_own_appointment_status(uuid, uuid, text) from public, anon;
grant execute on function private.set_own_appointment_status(uuid, uuid, text) to authenticated;
grant execute on function public.set_own_appointment_status(uuid, uuid, text) to authenticated;
