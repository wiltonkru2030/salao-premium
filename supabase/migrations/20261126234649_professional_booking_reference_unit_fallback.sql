-- Para referências antigas sem unidade, usa exclusivamente a unidade atribuída ao profissional.
-- Duração, preço e nomes vêm do Supabase, e o trigger da Agenda valida disponibilidade.
create or replace function private.create_own_appointment(
  target_org uuid, reference_appointment uuid, target_service uuid, local_start timestamp
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  professional uuid := private.current_professional_id(target_org);
  reference public.appointments%rowtype;
  target_branch uuid;
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
      and customer_id is not null;
  if not found then
    raise exception 'Cliente ou unidade indisponível para este profissional.' using errcode = '42501';
  end if;
  select coalesce(reference.branch_id,p.branch_id) into target_branch
  from public.professionals p where p.org_id=target_org and p.id=professional;
  if target_branch is null then
    raise exception 'O atendimento precisa estar vinculado a uma unidade.' using errcode = '23514';
  end if;
  select * into customer from public.customers
    where org_id = target_org and id = reference.customer_id and active
      and (branch_id is null or branch_id = target_branch);
  if not found then
    raise exception 'Cliente indisponível nesta unidade.' using errcode = '23514';
  end if;
  select s.* into service from public.services s
    join public.professional_services link on link.org_id = s.org_id and link.service_id = s.id
    where s.org_id = target_org and s.id = target_service and s.active
      and (s.branch_id is null or s.branch_id = target_branch)
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
  select target_org,target_branch,customer.id,professional,service.id,customer.name,customer.phone,
    service.name,p.name,starts,starts+make_interval(mins=>service.duration_minutes),service.price,'professional',auth.uid()
  from public.professionals p where p.org_id=target_org and p.id=professional
  returning id into new_id;
  return jsonb_build_object('id',new_id,'starts_at',starts);
end;
$function$;

