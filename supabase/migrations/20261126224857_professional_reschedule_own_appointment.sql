-- Remarca agendamento individual próprio, preservando a duração.
-- O trigger da Agenda continua responsável por expediente, bloqueios e conflitos.
create or replace function private.reschedule_own_appointment(
  target_org uuid, target_appointment uuid, expected_start timestamptz, new_local_start timestamp
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  professional uuid := private.current_professional_id(target_org);
  salon_timezone text;
  new_start timestamptz;
  saved record;
begin
  if professional is null then
    raise exception 'Acesso profissional indisponível.' using errcode = '42501';
  end if;
  select timezone into salon_timezone from public.organizations where id = target_org;
  new_start := new_local_start at time zone salon_timezone;
  if new_start is null or not isfinite(new_start) or new_start <= now()
     or (new_start at time zone salon_timezone) is distinct from new_local_start then
    raise exception 'Escolha um horário futuro válido no fuso do salão.' using errcode = '22023';
  end if;
  update public.appointments a
  set starts_at = new_start, ends_at = new_start + (a.ends_at - a.starts_at)
  where a.org_id = target_org and a.id = target_appointment and a.professional_id = professional
    and a.starts_at = expected_start and a.branch_id is not null
    and a.appointment_group_id is null and a.service_order_id is null
    and a.status in ('scheduled', 'confirmed')
  returning a.id, a.starts_at, a.ends_at into saved;
  if not found then
    raise exception 'O agendamento mudou ou não está disponível para reagendamento.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', saved.id, 'starts_at', saved.starts_at, 'ends_at', saved.ends_at);
end;
$function$;

create or replace function public.reschedule_own_appointment(
  target_org uuid, target_appointment uuid, expected_start timestamptz, new_local_start timestamp
)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.reschedule_own_appointment(target_org, target_appointment, expected_start, new_local_start);
$function$;

revoke all on function private.reschedule_own_appointment(uuid,uuid,timestamptz,timestamp) from public, anon;
revoke all on function public.reschedule_own_appointment(uuid,uuid,timestamptz,timestamp) from public, anon;
grant execute on function private.reschedule_own_appointment(uuid,uuid,timestamptz,timestamp) to authenticated;
grant execute on function public.reschedule_own_appointment(uuid,uuid,timestamptz,timestamp) to authenticated;
