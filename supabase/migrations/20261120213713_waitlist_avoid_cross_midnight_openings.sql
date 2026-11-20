-- Encaixes não podem atravessar o fim do dia local da unidade.
CREATE OR REPLACE FUNCTION private.find_appointment_waitlist_openings(p_org_id uuid, p_branch_id uuid, p_date date, p_limit integer DEFAULT 20)
 RETURNS TABLE(waitlist_id uuid, customer_id uuid, customer_name text, service_id uuid, service_name text, professional_id uuid, professional_name text, starts_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tz text;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para consultar encaixes.' using errcode='42501'; end if;
 if p_date is null or p_limit is null or p_limit not between 1 and 50
 then raise exception 'Selecione uma data e limite válidos.' using errcode='22023'; end if;
 select o.timezone into v_tz from public.organizations o where o.id=p_org_id;
 if v_tz is null or p_date<(now() at time zone v_tz)::date
 then raise exception 'Selecione uma data futura no fuso do salão.' using errcode='22023'; end if;
 -- A disponibilidade online só pode ser utilizada quando a unidade está publicada.
 if not exists(
  select 1 from public.salon_public_profiles sp
  join public.branch_public_profiles bp on bp.org_id=sp.org_id
  join public.branches b on b.org_id=bp.org_id and b.id=bp.branch_id and b.active
  where sp.org_id=p_org_id and sp.is_published and bp.branch_id=p_branch_id and bp.is_published
 ) then return; end if;
 return query
 with waiting as (
   select w.* from public.appointment_waitlist w
   where w.org_id=p_org_id and w.branch_id=p_branch_id and w.status in ('waiting','contacted')
     and p_date between w.preferred_from and w.preferred_until
   order by w.created_at,w.id limit 40
 )
 select w.id,w.customer_id,c.name,w.service_id,svc.name,s.professional_id,s.professional_name,s.starts_at
 from waiting w
 join public.customers c on c.org_id=w.org_id and c.id=w.customer_id and c.active
 join public.services svc on svc.org_id=w.org_id and svc.id=w.service_id and svc.active
 cross join lateral private.get_customer_available_slots(
  w.org_id,w.branch_id,w.service_id,p_date,w.professional_id,15) s
 where (s.starts_at at time zone v_tz)::time>=w.time_from
   and ((s.starts_at at time zone v_tz)+make_interval(mins=>svc.duration_minutes))::date=p_date
   and ((s.starts_at at time zone v_tz)+make_interval(mins=>svc.duration_minutes))::time<=w.time_until
 order by w.created_at,s.starts_at,w.id limit p_limit;
end;
$function$;
