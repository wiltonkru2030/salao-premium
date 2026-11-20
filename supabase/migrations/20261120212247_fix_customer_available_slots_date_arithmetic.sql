-- Corrige data + timestamp na geração das vagas sem alterar critérios de disponibilidade.
CREATE OR REPLACE FUNCTION private.get_customer_available_slots(p_org_id uuid, p_branch_id uuid, p_service_id uuid, p_date date, p_professional_id uuid, p_interval_minutes integer)
 RETURNS TABLE(starts_at timestamp with time zone, professional_id uuid, professional_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_timezone text;
  v_duration integer;
begin
  if p_org_id is null or p_branch_id is null or p_service_id is null or p_date is null then
    raise exception 'Informe salão, unidade, serviço e data.' using errcode='22023';
  end if;
  if p_interval_minutes is null or p_interval_minutes < 5 or p_interval_minutes > 60 then
    raise exception 'O intervalo de consulta deve estar entre 5 e 60 minutos.' using errcode='22023';
  end if;

  select org.timezone,service.duration_minutes into v_timezone,v_duration
  from public.salon_public_profiles profile
  join public.branch_public_profiles branch_profile on branch_profile.org_id=profile.org_id
    and branch_profile.branch_id=p_branch_id and branch_profile.is_published
  join public.organizations org on org.id=profile.org_id
  join public.branches branch on branch.org_id=profile.org_id and branch.id=p_branch_id and branch.active
  join public.services service on service.org_id=profile.org_id and service.id=p_service_id and service.active
    and (service.branch_id is null or service.branch_id=p_branch_id)
  where profile.org_id=p_org_id and profile.is_published;

  if not found then
    raise exception 'Esta unidade ou serviço não está publicado para agendamento.' using errcode='22023';
  end if;
  if p_date < (now() at time zone v_timezone)::date then
    raise exception 'Escolha uma data de hoje em diante.' using errcode='22023';
  end if;

  return query
  with eligible as (
    select distinct professional.id as pro_id,professional.name as pro_name,
      greatest(branch_hours.opens_at,working.starts_at) as local_open,
      least(branch_hours.closes_at,working.ends_at) as local_close
    from public.professional_services assignment
    join public.professionals professional on professional.org_id=assignment.org_id
      and professional.id=assignment.professional_id and professional.active
      and (professional.branch_id is null or professional.branch_id=p_branch_id)
    join public.branch_business_hours branch_hours on branch_hours.org_id=p_org_id
      and branch_hours.branch_id=p_branch_id
      and branch_hours.weekday=extract(dow from p_date)::integer and branch_hours.active
    join public.professional_working_hours working on working.org_id=p_org_id
      and working.professional_id=professional.id
      and working.weekday=extract(dow from p_date)::integer and working.active
    where assignment.org_id=p_org_id and assignment.service_id=p_service_id
      and (p_professional_id is null or professional.id=p_professional_id)
      and greatest(branch_hours.opens_at,working.starts_at)<least(branch_hours.closes_at,working.ends_at)
  ),
  candidates as (
    select eligible.pro_id,eligible.pro_name,
      generated.local_start::timestamp as local_start,
      (generated.local_start+make_interval(mins=>v_duration))::timestamp as local_end
    from eligible
    cross join lateral generate_series(
      (p_date+eligible.local_open)::timestamp,
      (p_date+eligible.local_close-make_interval(mins=>v_duration))::timestamp,
      make_interval(mins=>p_interval_minutes)
    ) as generated(local_start)
  )
  select (candidate.local_start at time zone v_timezone),candidate.pro_id,candidate.pro_name
  from candidates candidate
  where (candidate.local_start at time zone v_timezone)>now()
    and not exists(select 1 from public.appointments appointment
      where appointment.org_id=p_org_id and appointment.professional_id=candidate.pro_id
        and appointment.status not in ('cancelled','no_show')
        and (candidate.local_start at time zone v_timezone)<appointment.ends_at
        and (candidate.local_end at time zone v_timezone)>appointment.starts_at)
    and not exists(select 1 from public.appointment_blocks block
      where block.org_id=p_org_id and (block.professional_id is null or block.professional_id=candidate.pro_id)
        and (block.branch_id is null or block.branch_id=p_branch_id)
        and (candidate.local_start at time zone v_timezone)<block.ends_at
        and (candidate.local_end at time zone v_timezone)>block.starts_at)
    and not exists(select 1 from public.appointment_holds hold
      where hold.org_id=p_org_id and hold.branch_id=p_branch_id and hold.professional_id=candidate.pro_id
        and hold.status='active' and hold.expires_at>now()
        and (candidate.local_start at time zone v_timezone)<hold.ends_at
        and (candidate.local_end at time zone v_timezone)>hold.starts_at)
    and not exists(select 1 from public.branch_closures closure
      where closure.org_id=p_org_id and closure.branch_id=p_branch_id
        and (candidate.local_start at time zone v_timezone)<closure.ends_at
        and (candidate.local_end at time zone v_timezone)>closure.starts_at)
    and not exists(select 1 from public.professional_time_off time_off
      where time_off.org_id=p_org_id and time_off.professional_id=candidate.pro_id
        and (candidate.local_start at time zone v_timezone)<time_off.ends_at
        and (candidate.local_end at time zone v_timezone)>time_off.starts_at)
  order by 1,3;
end;
$function$;
