-- Contratos profissionais com unidade explícita; versões legadas preservadas.
-- Não confia na seleção do navegador: valida profissional, organização, unidade e vínculo ativos.
create function private.professional_selected_branch(target_org uuid,target_unit uuid)
returns uuid language sql stable security definer set search_path='' as $$
 select b.id from public.professionals p
 join public.branches b on b.org_id=p.org_id and b.id=target_unit and b.active
 where p.org_id=target_org and p.id=private.current_professional_id(target_org)
 and auth.uid() is not null and
 (p.branch_id=b.id or (p.branch_id is null and (b.is_main or b.id=any(p.additional_branch_ids))))
$$;
revoke all on function private.professional_selected_branch(uuid,uuid) from public,anon,authenticated;

create function private.create_professional_unit_appointment_at_branch(target_org uuid,target_unit uuid,target_customer uuid,target_service uuid,local_start timestamp without time zone) returns jsonb language plpgsql security definer set search_path='' AS $function$
declare
 professional uuid := private.current_professional_id(target_org);
 unit uuid := private.professional_selected_branch(target_org,target_unit);
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
 where s.org_id=target_org and s.id=target_service and s.active and s.archived_at is null and (s.branch_id is null or s.branch_id=unit) and link.professional_id=professional;
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
end $function$;
create function public.create_professional_unit_appointment_at_branch(target_org uuid,target_unit uuid,target_customer uuid,target_service uuid,local_start timestamp without time zone) returns jsonb language sql security invoker set search_path='' as $$ select private.create_professional_unit_appointment_at_branch($1,$2,$3,$4,$5) $$;
revoke all on function private.create_professional_unit_appointment_at_branch(uuid,uuid,uuid,uuid,timestamp without time zone), public.create_professional_unit_appointment_at_branch(uuid,uuid,uuid,uuid,timestamp without time zone) from public,anon,authenticated;
grant execute on function private.create_professional_unit_appointment_at_branch(uuid,uuid,uuid,uuid,timestamp without time zone),public.create_professional_unit_appointment_at_branch(uuid,uuid,uuid,uuid,timestamp without time zone) to authenticated;

create function private.list_professional_unit_customers_at_branch(target_org uuid,target_unit uuid,page_offset integer) returns table(id uuid,name text,phone text,branch_id uuid) language plpgsql stable security definer set search_path='' AS $function$
declare unit uuid := private.professional_selected_branch(target_org,target_unit);
begin
 if unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if page_offset is null or page_offset<0 then raise exception 'Página inválida.' using errcode='22023'; end if;
 return query select c.id,c.name,c.phone,c.branch_id from public.customers c
 where c.org_id=target_org and c.branch_id=unit and c.active
 order by c.name,c.id limit 200 offset page_offset;
end $function$;
create function public.list_professional_unit_customers_at_branch(target_org uuid,target_unit uuid,page_offset integer) returns table(id uuid,name text,phone text,branch_id uuid) language sql stable security invoker set search_path='' as $$ select * from private.list_professional_unit_customers_at_branch($1,$2,$3) $$;
revoke all on function private.list_professional_unit_customers_at_branch(uuid,uuid,integer), public.list_professional_unit_customers_at_branch(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function private.list_professional_unit_customers_at_branch(uuid,uuid,integer),public.list_professional_unit_customers_at_branch(uuid,uuid,integer) to authenticated;

create function private.list_professional_unit_services_at_branch(target_org uuid,target_unit uuid,page_offset integer) returns table(id uuid,name text,category text,duration_minutes integer,price numeric,linked boolean,editable boolean) language plpgsql stable security definer set search_path='' AS $function$
declare prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_selected_branch(target_org,target_unit);
begin
 if auth.uid() is null or prof is null or unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if page_offset is null or page_offset<0 then raise exception 'Página inválida.' using errcode='22023'; end if;
 return query select s.id,s.name,s.category,s.duration_minutes,s.price,
 exists(select 1 from public.professional_services l where l.org_id=target_org and l.service_id=s.id and l.professional_id=prof),
 (s.branch_id=unit and exists(select 1 from private.professional_service_authors a where a.org_id=target_org and a.service_id=s.id and a.professional_id=prof)
 and not exists(select 1 from public.professional_services l where l.org_id=target_org and l.service_id=s.id and l.professional_id<>prof)) is true
 from public.services s where s.org_id=target_org and s.active and s.archived_at is null and (s.branch_id is null or s.branch_id=unit)
 order by s.name,s.id limit 200 offset page_offset;
end $function$;
create function public.list_professional_unit_services_at_branch(target_org uuid,target_unit uuid,page_offset integer) returns table(id uuid,name text,category text,duration_minutes integer,price numeric,linked boolean,editable boolean) language sql stable security invoker set search_path='' as $$ select * from private.list_professional_unit_services_at_branch($1,$2,$3) $$;
revoke all on function private.list_professional_unit_services_at_branch(uuid,uuid,integer), public.list_professional_unit_services_at_branch(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function private.list_professional_unit_services_at_branch(uuid,uuid,integer),public.list_professional_unit_services_at_branch(uuid,uuid,integer) to authenticated;

create function private.professional_attendance_action_at_branch(target_org uuid,target_unit uuid,target_appointment uuid,operation text) returns jsonb language plpgsql security definer set search_path='' AS $function$
declare
 prof uuid:=private.current_professional_id(target_org);
 unit uuid:=private.professional_selected_branch(target_org,target_unit);
 a public.appointments%rowtype;
 o public.service_orders%rowtype;
 opened jsonb;
begin
 if auth.uid() is null or prof is null or unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 select * into a from public.appointments x where x.org_id=target_org and x.id=target_appointment and x.professional_id=prof and x.branch_id=unit for update;
 if not found then raise exception 'Atendimento não autorizado.' using errcode='42501'; end if;
 if a.appointment_group_id is not null then raise exception 'Atendimento agrupado: consulte a recepção.' using errcode='23514'; end if;
 if operation is null or operation not in ('start','finish') then raise exception 'Operação inválida.' using errcode='22023'; end if;
 if a.service_order_id is not null then
  select * into o from public.service_orders x where x.org_id=target_org and x.id=a.service_order_id and x.branch_id=unit and x.assigned_professional_id=prof and x.appointment_id=a.id and x.customer_id is not distinct from a.customer_id for update;
  if not found then raise exception 'Comanda compartilhada ou indisponível.' using errcode='42501'; end if;
  if exists(select 1 from public.appointments x where x.org_id=target_org and x.service_order_id=o.id and x.id<>a.id)
   or exists(select 1 from public.service_order_items i where i.org_id=target_org and i.order_id=o.id and i.professional_id is distinct from prof) then
    raise exception 'Comanda compartilhada: consulte a recepção.' using errcode='23514';
  end if;
  -- Repetição do pedido não recria comanda ou item.
  if operation='start' and a.status='in_progress' and o.status='in_progress' then
   return jsonb_build_object('id',a.id,'status',a.status,'order_id',o.id,'order_status',o.status);
  end if;
  if operation='finish' and a.status='completed' and o.status in ('awaiting_payment','partially_paid','closed') then
   return jsonb_build_object('id',a.id,'status',a.status,'order_id',o.id,'order_status',o.status);
  end if;
 end if;
 if operation='start' then
  if a.status not in ('scheduled','confirmed','arrived') or a.service_order_id is not null or a.service_id is null or a.customer_id is null then raise exception 'Agendamento indisponível para início.' using errcode='23514'; end if;
  -- O trigger legado usa preço atual; divergência requer revisão para não cobrar diferente do agendado.
  if not exists(select 1 from public.services s join public.professional_services l on l.org_id=s.org_id and l.service_id=s.id and l.professional_id=prof where s.org_id=target_org and s.id=a.service_id and s.active and s.archived_at is null and (s.branch_id=unit or s.branch_id is null) and s.price=a.price) then raise exception 'Confira o serviço e o preço com a recepção.' using errcode='23514'; end if;
  if exists(select 1 from public.service_order_items i where i.org_id=target_org and i.source_appointment_id=a.id) then raise exception 'Já existe lançamento para este atendimento.' using errcode='23514'; end if;
  opened:=private.start_appointment_service_order(a.id,null,false);
  return jsonb_build_object('id',a.id,'status','in_progress','order_id',opened->>'order_id','order_status',opened->>'status');
 end if;
 if a.status<>'in_progress' or o.id is null or o.status not in ('open','in_progress') then raise exception 'Atendimento indisponível para conclusão.' using errcode='23514'; end if;
 if exists(select 1 from public.service_order_payments p where p.org_id=target_org and p.order_id=o.id) then raise exception 'Comanda com movimentação: consulte o Caixa.' using errcode='23514'; end if;
 if not exists(select 1 from public.service_order_items i where i.org_id=target_org and i.order_id=o.id and i.source_appointment_id=a.id and i.professional_id=prof) then raise exception 'Serviço do atendimento não encontrado.' using errcode='23514'; end if;
 update public.service_orders set status='awaiting_payment',updated_at=now() where org_id=target_org and id=o.id;
 update public.appointments set status='completed',updated_at=now() where org_id=target_org and id=a.id;
 return jsonb_build_object('id',a.id,'status','completed','order_id',o.id,'order_status','awaiting_payment');
end $function$;
create function public.professional_attendance_action_at_branch(target_org uuid,target_unit uuid,target_appointment uuid,operation text) returns jsonb language sql security invoker set search_path='' as $$ select private.professional_attendance_action_at_branch($1,$2,$3,$4) $$;
revoke all on function private.professional_attendance_action_at_branch(uuid,uuid,uuid,text), public.professional_attendance_action_at_branch(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.professional_attendance_action_at_branch(uuid,uuid,uuid,text),public.professional_attendance_action_at_branch(uuid,uuid,uuid,text) to authenticated;

create function private.save_professional_unit_customer_at_branch(target_org uuid,target_unit uuid,target_customer uuid,customer_name text,customer_phone text) returns jsonb language plpgsql security definer set search_path='' AS $function$
declare
 unit uuid := private.professional_selected_branch(target_org,target_unit);
 clean_name text := btrim(coalesce(customer_name,''));
 clean_phone text := regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g');
 saved public.customers%rowtype;
begin
 if unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if char_length(clean_name) not between 2 and 120 or clean_phone !~ '^[0-9]{10,11}$' then
  raise exception 'Nome ou telefone inválido.' using errcode='22023';
 end if;
 -- Serializa cadastros deste contrato por organização e telefone.
 perform pg_advisory_xact_lock(hashtextextended(target_org::text||':'||clean_phone,0));
 if exists(select 1 from public.customers c where c.org_id=target_org
  and (target_customer is null or c.id<>target_customer)
  and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') in (clean_phone,'55'||clean_phone)) then
  raise exception 'Já existe um cadastro com este telefone. Consulte o salão.' using errcode='23505';
 end if;
 if target_customer is null then
  insert into public.customers(org_id,branch_id,name,phone)
  values(target_org,unit,clean_name,clean_phone) returning * into saved;
 else
  update public.customers c set name=clean_name,phone=clean_phone
  where c.org_id=target_org and c.branch_id=unit and c.id=target_customer and c.active
  returning * into saved;
 end if;
 if saved.id is null then raise exception 'Cliente não autorizado.' using errcode='42501'; end if;
 return jsonb_build_object('id',saved.id,'name',saved.name,'phone',saved.phone,'branch_id',saved.branch_id);
end $function$;
create function public.save_professional_unit_customer_at_branch(target_org uuid,target_unit uuid,target_customer uuid,customer_name text,customer_phone text) returns jsonb language sql security invoker set search_path='' as $$ select private.save_professional_unit_customer_at_branch($1,$2,$3,$4,$5) $$;
revoke all on function private.save_professional_unit_customer_at_branch(uuid,uuid,uuid,text,text), public.save_professional_unit_customer_at_branch(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.save_professional_unit_customer_at_branch(uuid,uuid,uuid,text,text),public.save_professional_unit_customer_at_branch(uuid,uuid,uuid,text,text) to authenticated;

create function private.save_professional_unit_service_at_branch(target_org uuid,target_unit uuid,target_service uuid,service_name text,service_category text,service_minutes integer,service_price numeric) returns uuid language plpgsql security definer set search_path='' AS $function$
declare prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_selected_branch(target_org,target_unit);
 clean_name text:=btrim(coalesce(service_name,'')); clean_category text:=btrim(coalesce(service_category,'')); saved uuid;
begin
 if auth.uid() is null or prof is null or unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if char_length(clean_name) not between 2 and 120 or char_length(clean_category)>100 or service_minutes is null or service_minutes not between 1 and 1440 or service_price is null or service_price::text in ('NaN','Infinity','-Infinity') or service_price<0 or service_price>999999.99 or round(service_price,2)<>service_price then raise exception 'Dados do serviço inválidos.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text||':'||lower(clean_name),0));
 if exists(select 1 from public.services s where s.org_id=target_org and (s.branch_id is null or s.branch_id=unit) and s.active and lower(btrim(s.name))=lower(clean_name) and (target_service is null or s.id<>target_service)) then raise exception 'Serviço já cadastrado.' using errcode='23505'; end if;
 if target_service is null then
  insert into public.services(org_id,branch_id,name,category,duration_minutes,price) values(target_org,unit,clean_name,nullif(clean_category,''),service_minutes,service_price) returning id into saved;
  insert into private.professional_service_authors values(target_org,saved,prof);
  insert into public.professional_services(org_id,professional_id,service_id) values(target_org,prof,saved);
 else
  perform 1 from public.services s where s.org_id=target_org and s.id=target_service and s.branch_id=unit and s.active and s.archived_at is null for update;
  if not found or not exists(select 1 from private.professional_service_authors a where a.org_id=target_org and a.service_id=target_service and a.professional_id=prof)
   or exists(select 1 from public.professional_services l where l.org_id=target_org and l.service_id=target_service and l.professional_id<>prof) then raise exception 'Edição não autorizada.' using errcode='42501'; end if;
  update public.services s set name=clean_name,category=nullif(clean_category,''),duration_minutes=service_minutes,price=service_price where s.org_id=target_org and s.id=target_service returning id into saved;
 end if;
 return saved;
end $function$;
create function public.save_professional_unit_service_at_branch(target_org uuid,target_unit uuid,target_service uuid,service_name text,service_category text,service_minutes integer,service_price numeric) returns uuid language sql security invoker set search_path='' as $$ select private.save_professional_unit_service_at_branch($1,$2,$3,$4,$5,$6,$7) $$;
revoke all on function private.save_professional_unit_service_at_branch(uuid,uuid,uuid,text,text,integer,numeric), public.save_professional_unit_service_at_branch(uuid,uuid,uuid,text,text,integer,numeric) from public,anon,authenticated;
grant execute on function private.save_professional_unit_service_at_branch(uuid,uuid,uuid,text,text,integer,numeric),public.save_professional_unit_service_at_branch(uuid,uuid,uuid,text,text,integer,numeric) to authenticated;

create function private.set_professional_unit_service_link_at_branch(target_org uuid,target_unit uuid,target_service uuid,link_enabled boolean) returns boolean language plpgsql security definer set search_path='' AS $function$
declare prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_selected_branch(target_org,target_unit);
begin
 if auth.uid() is null or prof is null or unit is null or link_enabled is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 perform 1 from public.services s where s.org_id=target_org and s.id=target_service and s.active and s.archived_at is null and (s.branch_id is null or s.branch_id=unit) for update;
 if not found then raise exception 'Serviço não autorizado.' using errcode='42501'; end if;
 if link_enabled then
  insert into public.professional_services(org_id,professional_id,service_id) values(target_org,prof,target_service) on conflict do nothing;
 else
  if exists(select 1 from public.appointments a where a.org_id=target_org and a.professional_id=prof and a.service_id=target_service and a.ends_at>now() and a.status not in ('cancelled','completed','no_show')) then raise exception 'Há agendamentos ativos para este serviço.' using errcode='23514'; end if;
  delete from public.professional_services l where l.org_id=target_org and l.professional_id=prof and l.service_id=target_service;
 end if;
 return link_enabled;
end $function$;
create function public.set_professional_unit_service_link_at_branch(target_org uuid,target_unit uuid,target_service uuid,link_enabled boolean) returns boolean language sql security invoker set search_path='' as $$ select private.set_professional_unit_service_link_at_branch($1,$2,$3,$4) $$;
revoke all on function private.set_professional_unit_service_link_at_branch(uuid,uuid,uuid,boolean), public.set_professional_unit_service_link_at_branch(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.set_professional_unit_service_link_at_branch(uuid,uuid,uuid,boolean),public.set_professional_unit_service_link_at_branch(uuid,uuid,uuid,boolean) to authenticated;
;
