-- Agendamento direto por cliente ativo da unidade principal atribuída.
-- O banco determina unidade, profissional, duração e preço; o trigger existente valida disponibilidade.
create or replace function private.create_professional_unit_appointment(target_org uuid,target_customer uuid,target_service uuid,local_start timestamp)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 professional uuid := private.current_professional_id(target_org);
 unit uuid := private.professional_customer_branch(target_org);
 customer public.customers%rowtype;
 service public.services%rowtype;
 salon_timezone text;
 starts timestamptz;
 new_id uuid;
begin
 if auth.uid() is null or professional is null or unit is null then
  raise exception 'Unidade não autorizada.' using errcode='42501';
 end if;
 select * into customer from public.customers c where c.org_id=target_org and c.id=target_customer and c.branch_id=unit and c.active;
 if not found then raise exception 'Cliente indisponível nesta unidade.' using errcode='42501'; end if;
 select s.* into service from public.services s join public.professional_services link on link.org_id=s.org_id and link.service_id=s.id
 where s.org_id=target_org and s.id=target_service and s.active and (s.branch_id is null or s.branch_id=unit) and link.professional_id=professional;
 if not found or service.duration_minutes<=0 then raise exception 'Serviço indisponível.' using errcode='23514'; end if;
 select o.timezone into salon_timezone from public.organizations o where o.id=target_org;
 starts := local_start at time zone salon_timezone;
 if starts is null or not isfinite(starts) or starts<=now() or (starts at time zone salon_timezone) is distinct from local_start then
  raise exception 'Informe um horário futuro válido.' using errcode='22023';
 end if;
 insert into public.appointments(org_id,branch_id,customer_id,professional_id,service_id,customer_name,customer_phone,service_name,professional_name,starts_at,ends_at,price,booking_source,created_by)
 select target_org,unit,customer.id,professional,service.id,customer.name,customer.phone,service.name,p.name,starts,starts+make_interval(mins=>service.duration_minutes),service.price,'professional',auth.uid()
 from public.professionals p where p.org_id=target_org and p.id=professional returning id into new_id;
 return jsonb_build_object('id',new_id,'starts_at',starts);
end $$;
create or replace function public.create_professional_unit_appointment(target_org uuid,target_customer uuid,target_service uuid,local_start timestamp)
returns jsonb language sql security invoker set search_path='' as $$
 select private.create_professional_unit_appointment($1,$2,$3,$4)
$$;
revoke all on function private.create_professional_unit_appointment(uuid,uuid,uuid,timestamp),public.create_professional_unit_appointment(uuid,uuid,uuid,timestamp) from public,anon;
grant execute on function private.create_professional_unit_appointment(uuid,uuid,uuid,timestamp),public.create_professional_unit_appointment(uuid,uuid,uuid,timestamp) to authenticated;
