-- Cria um agendamento próprio a partir de cliente e unidade já acessíveis ao profissional.
-- Duração, preço e nomes vêm do Supabase, e o trigger da Agenda valida disponibilidade.
create or replace function private.create_own_appointment(
  target_org uuid, reference_appointment uuid, target_service uuid, local_start timestamp
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  professional uuid := private.current_professional_id(target_org);
  reference public.appointments%rowtype;
  customer public.customers%rowtype;
  service public.services%rowtype;
  salon_timezone text;
  starts timestamptz;
  new_id uuid;
begin
  if professional is null then
    raise exception 'Acesso profissional indisponível.' using errcode = '42501';
  end if;
  select * into reference from public.appointments
    where org_id = target_org and id = reference_appointment and professional_id = professional
      and branch_id is not null and customer_id is not null;
  if not found then
    raise exception 'Cliente ou unidade indisponível para este profissional.' using errcode = '42501';
  end if;
  select * into customer from public.customers
    where org_id = target_org and id = reference.customer_id and active
      and (branch_id is null or branch_id = reference.branch_id);
  if not found then
    raise exception 'Cliente indisponível nesta unidade.' using errcode = '23514';
  end if;
  select s.* into service from public.services s
    join public.professional_services link on link.org_id = s.org_id and link.service_id = s.id
    where s.org_id = target_org and s.id = target_service and s.active
      and (s.branch_id is null or s.branch_id = reference.branch_id)
      and link.professional_id = professional;
  if not found then
    raise exception 'Serviço não habilitado para este profissional e unidade.' using errcode = '23514';
  end if;
  select timezone into salon_timezone from public.organizations where id = target_org;
  starts := local_start at time zone salon_timezone;
  if starts is null or not isfinite(starts) or starts <= now()
    or (starts at time zone salon_timezone) is distinct from local_start then
    raise exception 'Escolha um horário futuro válido no fuso do salão.' using errcode = '22023';
  end if;
  insert into public.appointments (
    org_id,branch_id,customer_id,professional_id,service_id,customer_name,
    customer_phone,service_name,professional_name,starts_at,ends_at,price,booking_source,created_by
  )
  select target_org,reference.branch_id,customer.id,professional,service.id,customer.name,customer.phone,
    service.name,p.name,starts,starts+make_interval(mins=>service.duration_minutes),service.price,'professional',auth.uid()
  from public.professionals p where p.org_id=target_org and p.id=professional
  returning id into new_id;
  return jsonb_build_object('id',new_id,'starts_at',starts);
end;
$function$;

create or replace function public.create_own_appointment(target_org uuid, reference_appointment uuid, target_service uuid, local_start timestamp)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.create_own_appointment($1,$2,$3,$4);
$function$;

revoke all on function private.create_own_appointment(uuid,uuid,uuid,timestamp) from public,anon;
revoke all on function public.create_own_appointment(uuid,uuid,uuid,timestamp) from public,anon;
grant execute on function private.create_own_appointment(uuid,uuid,uuid,timestamp) to authenticated;
grant execute on function public.create_own_appointment(uuid,uuid,uuid,timestamp) to authenticated;
