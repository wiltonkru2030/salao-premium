-- Disponibilidade privada do profissional: somente horários livres, sem revelar clientes ou reservas.
create function private.list_own_professional_booking_slots(target_org uuid,target_unit uuid,target_service uuid,target_day date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_selected_branch(target_org,target_unit);
 duration integer; tz text; weekday_num integer; slots jsonb; local_today date;
begin
 if auth.uid() is null or prof is null or unit is null then raise exception 'Unidade não autorizada.' using errcode='42501';end if;
 select timezone into tz from public.organizations where id=target_org;
 local_today:=(now() at time zone tz)::date;
 if target_day is null or not isfinite(target_day) or target_day<local_today or target_day>local_today+366 then return jsonb_build_object('reason','invalid_day','slots','[]'::jsonb);end if;
 select s.duration_minutes into duration from public.services s join public.professional_services l on l.org_id=s.org_id and l.service_id=s.id and l.professional_id=prof
 where s.org_id=target_org and s.id=target_service and s.active and s.archived_at is null and (s.branch_id is null or s.branch_id=unit);
 if not found or duration is null or duration<=0 or duration>1440 then raise exception 'Serviço indisponível.' using errcode='23514';end if;
 weekday_num:=extract(dow from target_day)::integer;
 if not exists(select 1 from public.branch_business_hours h where h.org_id=target_org and h.branch_id=unit and h.weekday=weekday_num and h.active) then return jsonb_build_object('reason','branch_closed','slots','[]'::jsonb);end if;
 if not exists(select 1 from public.professional_working_hours h where h.org_id=target_org and h.professional_id=prof and h.weekday=weekday_num and h.active) then return jsonb_build_object('reason','professional_closed','slots','[]'::jsonb);end if;
 with candidates as (
 select distinct t.local_start,(t.local_start at time zone tz) as starts
 from public.branch_business_hours bh join public.professional_working_hours ph on ph.org_id=bh.org_id and ph.professional_id=prof and ph.weekday=bh.weekday and ph.active
 cross join lateral generate_series(target_day+greatest(bh.opens_at,ph.starts_at),target_day+least(bh.closes_at,ph.ends_at)-make_interval(mins=>duration),interval '5 minutes') t(local_start)
 where bh.org_id=target_org and bh.branch_id=unit and bh.weekday=weekday_num and bh.active
 ), available as (
 select c.local_start from candidates c where c.starts>now()
 and (c.starts at time zone tz)=c.local_start
 and ((c.starts+make_interval(mins=>duration)) at time zone tz)=c.local_start+make_interval(mins=>duration)
 and not exists(select 1 from public.appointments a where a.org_id=target_org and a.professional_id=prof and a.status not in ('cancelled','no_show') and c.starts<a.ends_at and c.starts+make_interval(mins=>duration)>a.starts_at)
 and not exists(select 1 from public.appointment_blocks b where b.org_id=target_org and (b.professional_id is null or b.professional_id=prof) and (b.branch_id is null or b.branch_id=unit) and c.starts<b.ends_at and c.starts+make_interval(mins=>duration)>b.starts_at)
 and not exists(select 1 from public.branch_closures b where b.org_id=target_org and b.branch_id=unit and c.starts<b.ends_at and c.starts+make_interval(mins=>duration)>b.starts_at)
 and not exists(select 1 from public.professional_time_off b where b.org_id=target_org and b.professional_id=prof and c.starts<b.ends_at and c.starts+make_interval(mins=>duration)>b.starts_at)
 and not exists(select 1 from public.appointment_holds b where b.org_id=target_org and b.professional_id=prof and b.status='active' and b.expires_at>now() and c.starts<b.ends_at and c.starts+make_interval(mins=>duration)>b.starts_at)
 )
 select coalesce(jsonb_agg(to_char(local_start,'HH24:MI') order by local_start),'[]'::jsonb) into slots from available;
 return jsonb_build_object('reason',case when jsonb_array_length(slots)=0 then 'no_slots' else 'available' end,'slots',slots);
end $$;
create function public.list_own_professional_booking_slots(target_org uuid,target_unit uuid,target_service uuid,target_day date)
returns jsonb language sql stable security invoker set search_path='' as $$select private.list_own_professional_booking_slots($1,$2,$3,$4)$$;
revoke all on function private.list_own_professional_booking_slots(uuid,uuid,uuid,date),public.list_own_professional_booking_slots(uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function private.list_own_professional_booking_slots(uuid,uuid,uuid,date),public.list_own_professional_booking_slots(uuid,uuid,uuid,date) to authenticated;

