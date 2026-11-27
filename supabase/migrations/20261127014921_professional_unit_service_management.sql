-- Gerenciamento do catálogo pelo profissional: autoria privada e escopo de unidade.
create table if not exists private.professional_service_authors(
 org_id uuid not null, service_id uuid not null, professional_id uuid not null,
 primary key(org_id,service_id),
 foreign key(org_id,service_id) references public.services(org_id,id) on delete cascade,
 foreign key(org_id,professional_id) references public.professionals(org_id,id) on delete cascade
);
alter table private.professional_service_authors enable row level security;
revoke all on private.professional_service_authors from public,anon,authenticated;

create or replace function private.list_professional_unit_services(target_org uuid,page_offset integer default 0)
returns table(id uuid,name text,category text,duration_minutes integer,price numeric,linked boolean,editable boolean)
language plpgsql stable security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_customer_branch(target_org);
begin
 if auth.uid() is null or prof is null or unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if page_offset is null or page_offset<0 then raise exception 'Página inválida.' using errcode='22023'; end if;
 return query select s.id,s.name,s.category,s.duration_minutes,s.price,
 exists(select 1 from public.professional_services l where l.org_id=target_org and l.service_id=s.id and l.professional_id=prof),
 (s.branch_id=unit and exists(select 1 from private.professional_service_authors a where a.org_id=target_org and a.service_id=s.id and a.professional_id=prof)
 and not exists(select 1 from public.professional_services l where l.org_id=target_org and l.service_id=s.id and l.professional_id<>prof)) is true
 from public.services s where s.org_id=target_org and s.active and s.archived_at is null and (s.branch_id is null or s.branch_id=unit)
 order by s.name,s.id limit 200 offset page_offset;
end $$;

create or replace function private.save_professional_unit_service(target_org uuid,target_service uuid,service_name text,service_category text,service_minutes integer,service_price numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_customer_branch(target_org);
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
end $$;

-- Desvincula apenas o próprio profissional; impede remover serviço com agenda futura ativa.
create or replace function private.set_professional_unit_service_link(target_org uuid,target_service uuid,link_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); unit uuid:=private.professional_customer_branch(target_org);
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
end $$;

create or replace function public.list_professional_unit_services(target_org uuid,page_offset integer default 0)
returns table(id uuid,name text,category text,duration_minutes integer,price numeric,linked boolean,editable boolean)
language sql stable security invoker set search_path='' as $$ select * from private.list_professional_unit_services($1,$2) $$;
create or replace function public.save_professional_unit_service(target_org uuid,target_service uuid,service_name text,service_category text,service_minutes integer,service_price numeric)
returns uuid language sql security invoker set search_path='' as $$ select private.save_professional_unit_service($1,$2,$3,$4,$5,$6) $$;
create or replace function public.set_professional_unit_service_link(target_org uuid,target_service uuid,link_enabled boolean)
returns boolean language sql security invoker set search_path='' as $$ select private.set_professional_unit_service_link($1,$2,$3) $$;
revoke all on function private.list_professional_unit_services(uuid,integer),public.list_professional_unit_services(uuid,integer),private.save_professional_unit_service(uuid,uuid,text,text,integer,numeric),public.save_professional_unit_service(uuid,uuid,text,text,integer,numeric),private.set_professional_unit_service_link(uuid,uuid,boolean),public.set_professional_unit_service_link(uuid,uuid,boolean) from public,anon;
grant execute on function private.list_professional_unit_services(uuid,integer),public.list_professional_unit_services(uuid,integer),private.save_professional_unit_service(uuid,uuid,text,text,integer,numeric),public.save_professional_unit_service(uuid,uuid,text,text,integer,numeric),private.set_professional_unit_service_link(uuid,uuid,boolean),public.set_professional_unit_service_link(uuid,uuid,boolean) to authenticated;
