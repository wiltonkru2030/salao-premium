-- Edição do próprio expediente: autoridade explícita e trava compartilhada com agendamento.
create function private.save_own_professional_working_hours(target_org uuid,target_entry uuid,target_weekday integer,target_start time,target_end time,remove_entry boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); saved uuid; previous_day integer; tz text;
begin
 if auth.uid() is null or prof is null then raise exception 'Expediente não autorizado.' using errcode='42501'; end if;
 if remove_entry is null then raise exception 'Operação inválida.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text||':'||prof::text,0));
 if target_entry is not null then
  select h.weekday into previous_day from public.professional_working_hours h where h.id=target_entry and h.org_id=target_org and h.professional_id=prof for update;
  if not found then raise exception 'Horário não autorizado.' using errcode='42501';end if;
 end if;
 if remove_entry then
  if target_entry is null then raise exception 'Horário inválido.' using errcode='22023';end if;
  delete from public.professional_working_hours where id=target_entry and org_id=target_org and professional_id=prof returning id into saved;
 else
  if target_weekday is null or target_weekday not between 0 and 6 or target_start is null or target_end is null or target_start>=target_end then raise exception 'Informe um intervalo válido.' using errcode='22023';end if;
  if exists(select 1 from public.professional_working_hours h where h.org_id=target_org and h.professional_id=prof and h.weekday=target_weekday and h.active and h.id is distinct from target_entry and h.starts_at<target_end and h.ends_at>target_start) then raise exception 'Expediente sobreposto.' using errcode='23P01';end if;
  if target_entry is null then
   insert into public.professional_working_hours(org_id,professional_id,weekday,starts_at,ends_at,active) values(target_org,prof,target_weekday,target_start,target_end,true) returning id into saved;
  else
   update public.professional_working_hours set weekday=target_weekday,starts_at=target_start,ends_at=target_end,active=true,updated_at=now() where id=target_entry and org_id=target_org and professional_id=prof returning id into saved;
  end if;
 end if;
 select timezone into tz from public.organizations where id=target_org;
 if exists(select 1 from public.appointments a where a.org_id=target_org and a.professional_id=prof and a.starts_at>=now() and a.status not in ('cancelled','no_show','completed')
 and extract(dow from a.starts_at at time zone tz)::integer in (previous_day,target_weekday)
 and not exists(select 1 from public.professional_working_hours h where h.org_id=target_org and h.professional_id=prof and h.active and h.weekday=extract(dow from a.starts_at at time zone tz)::integer and h.starts_at<=(a.starts_at at time zone tz)::time and h.ends_at>=(a.ends_at at time zone tz)::time)) then
  raise exception 'A mudança deixaria um atendimento futuro fora do expediente.' using errcode='23514';
 end if;
 return saved;
end $$;
create function public.save_own_professional_working_hours(target_org uuid,target_entry uuid,target_weekday integer,target_start time,target_end time,remove_entry boolean)
returns uuid language sql security invoker set search_path='' as $$select private.save_own_professional_working_hours($1,$2,$3,$4,$5,$6)$$;
revoke all on function private.save_own_professional_working_hours(uuid,uuid,integer,time,time,boolean), public.save_own_professional_working_hours(uuid,uuid,integer,time,time,boolean) from public,anon,authenticated;
grant execute on function private.save_own_professional_working_hours(uuid,uuid,integer,time,time,boolean),public.save_own_professional_working_hours(uuid,uuid,integer,time,time,boolean) to authenticated;

