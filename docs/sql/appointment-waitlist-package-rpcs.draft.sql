-- RPCs transacionais para combos e lista de espera; nenhuma função pública é SECURITY DEFINER.
begin;

create or replace function private.save_service_package(
 p_org_id uuid,p_branch_id uuid,p_name text,p_description text,
 p_reference_price numeric,p_items jsonb,p_package_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare
 v_id uuid;
 v_line record;
 v_service uuid;
 v_quantity integer;
 v_pause integer;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager']),false)
 then raise exception 'Seu perfil não pode gerenciar pacotes.' using errcode='42501'; end if;
 if p_branch_id is not null and not exists(
  select 1 from public.branches b where b.org_id=p_org_id and b.id=p_branch_id and b.active
 ) then raise exception 'Selecione uma unidade ativa.' using errcode='22023'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 120 or char_length(coalesce(p_description,''))>1000
 then raise exception 'Confira o nome e a descrição do pacote.' using errcode='22023'; end if;
 if p_reference_price is not null and
   (p_reference_price::text in ('NaN','Infinity','-Infinity') or p_reference_price<0
    or p_reference_price<>round(p_reference_price,2) or p_reference_price>9999999999.99)
 then raise exception 'Informe preço de referência válido, com dois decimais.' using errcode='22023'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20
 then raise exception 'Adicione de um a vinte serviços ao pacote.' using errcode='22023'; end if;

 -- Valida integralmente antes de substituir a composição atual.
 for v_line in select value,ordinality from jsonb_array_elements(p_items) with ordinality loop
   if jsonb_typeof(v_line.value)<>'object'
     or coalesce(v_line.value->>'service_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(v_line.value->>'quantity','') !~ '^[0-9]{1,2}$'
     or coalesce(v_line.value->>'pause_after_minutes','') !~ '^[0-9]{1,3}$'
   then raise exception 'Um item do pacote possui dados inválidos.' using errcode='22023'; end if;
   v_quantity:=(v_line.value->>'quantity')::integer;
   v_pause:=(v_line.value->>'pause_after_minutes')::integer;
   if v_quantity not between 1 and 20 or v_pause not between 0 and 720 then
     raise exception 'Quantidade ou pausa fora do limite permitido.' using errcode='22023';
   end if;
   select s.id into v_service from public.services s
    where s.org_id=p_org_id and s.id=(v_line.value->>'service_id')::uuid
      and s.active and (s.branch_id is null or s.branch_id=p_branch_id)
    for key share;
   if not found then raise exception 'O pacote contém serviço indisponível nesta unidade.' using errcode='22023'; end if;
 end loop;
 if p_package_id is null then
   insert into public.service_packages(org_id,branch_id,name,description,reference_price)
    values(p_org_id,p_branch_id,btrim(p_name),nullif(btrim(p_description),''),p_reference_price)
    returning id into v_id;
 else
   select p.id into v_id from public.service_packages p
    where p.org_id=p_org_id and p.id=p_package_id for update;
   if not found then raise exception 'O pacote selecionado não foi encontrado.' using errcode='22023'; end if;
   update public.service_packages set branch_id=p_branch_id,name=btrim(p_name),
    description=nullif(btrim(p_description),''),reference_price=p_reference_price,updated_at=now()
    where org_id=p_org_id and id=v_id;
   delete from public.service_package_items where org_id=p_org_id and package_id=v_id;
 end if;
 insert into public.service_package_items(org_id,package_id,service_id,sort_order,quantity,pause_after_minutes)
 select p_org_id,v_id,(value->>'service_id')::uuid,ordinality::integer,
   (value->>'quantity')::integer,(value->>'pause_after_minutes')::integer
 from jsonb_array_elements(p_items) with ordinality;
 return v_id;
end;
$fn$;

create or replace function public.save_service_package(
 p_org_id uuid,p_branch_id uuid,p_name text,p_description text,
 p_reference_price numeric,p_items jsonb,p_package_id uuid default null)
returns uuid language sql security invoker set search_path='' as $fn$
 select private.save_service_package(p_org_id,p_branch_id,p_name,p_description,p_reference_price,p_items,p_package_id);
$fn$;

create or replace function private.set_service_package_active(p_org_id uuid,p_package_id uuid,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_id uuid;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager']),false)
 then raise exception 'Sem permissão para alterar pacotes.' using errcode='42501'; end if;
 if p_active is null then raise exception 'Informe a situação do pacote.' using errcode='22023'; end if;
 update public.service_packages p set active=p_active,updated_at=now()
 where p.org_id=p_org_id and p.id=p_package_id returning p.id into v_id;
 if v_id is null then raise exception 'Pacote não encontrado.' using errcode='22023'; end if;
 return v_id;
end;
$fn$;
create or replace function public.set_service_package_active(p_org_id uuid,p_package_id uuid,p_active boolean)
returns uuid language sql security invoker set search_path='' as $fn$
 select private.set_service_package_active(p_org_id,p_package_id,p_active);
$fn$;

create or replace function private.add_appointment_waitlist(
 p_org_id uuid,p_branch_id uuid,p_customer_id uuid,p_service_id uuid,p_professional_id uuid,
 p_preferred_from date,p_preferred_until date,p_time_from time,p_time_until time,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_id uuid;v_timezone text;v_today date;v_duration integer;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para registrar a lista de espera.' using errcode='42501'; end if;
 select o.timezone into v_timezone from public.organizations o where o.id=p_org_id;
 if not found then raise exception 'Organização inválida.' using errcode='22023'; end if;
 v_today:=(now() at time zone v_timezone)::date;
 if p_preferred_from is null or p_preferred_until is null or p_preferred_from<v_today
   or p_preferred_from>v_today+90 or p_preferred_until>v_today+90
   or p_preferred_until<p_preferred_from or p_time_from is null or p_time_until is null
   or p_time_until<=p_time_from
 then raise exception 'Informe datas e horários futuros válidos, dentro de 90 dias.' using errcode='22023'; end if;
 if char_length(coalesce(p_notes,''))>500 then raise exception 'As observações devem ter até 500 caracteres.' using errcode='22023'; end if;
 if not exists(select 1 from public.branches b where b.org_id=p_org_id and b.id=p_branch_id and b.active)
 then raise exception 'A unidade informada está indisponível.' using errcode='22023'; end if;
 if not exists(select 1 from public.customers c where c.org_id=p_org_id and c.id=p_customer_id and c.active)
 then raise exception 'Cliente não encontrado ou inativo.' using errcode='22023'; end if;
 select s.duration_minutes into v_duration from public.services s where s.org_id=p_org_id
  and s.id=p_service_id and s.active and (s.branch_id is null or s.branch_id=p_branch_id);
 if not found then raise exception 'Serviço indisponível nesta unidade.' using errcode='22023'; end if;
 if (extract(epoch from (p_time_until-p_time_from)))/60<v_duration
 then raise exception 'A janela informada é menor que a duração do serviço.' using errcode='22023'; end if;
 if p_professional_id is not null and not exists(
   select 1 from public.professionals p
   join public.professional_services ps on ps.org_id=p.org_id and ps.professional_id=p.id
   where p.org_id=p_org_id and p.id=p_professional_id and p.active
    and (p.branch_id is null or p.branch_id=p_branch_id) and ps.service_id=p_service_id
 ) then raise exception 'Profissional não habilitado para esse serviço.' using errcode='22023'; end if;
 insert into public.appointment_waitlist(org_id,branch_id,customer_id,service_id,professional_id,
  preferred_from,preferred_until,time_from,time_until,notes)
 values(p_org_id,p_branch_id,p_customer_id,p_service_id,p_professional_id,
  p_preferred_from,p_preferred_until,p_time_from,p_time_until,nullif(btrim(p_notes),''))
 returning id into v_id;
 return v_id;
exception when unique_violation then
 raise exception 'Já existe uma solicitação ativa para esta cliente, serviço e profissional.' using errcode='23505';
end;
$fn$;
create or replace function public.add_appointment_waitlist(
 p_org_id uuid,p_branch_id uuid,p_customer_id uuid,p_service_id uuid,p_professional_id uuid,
 p_preferred_from date,p_preferred_until date,p_time_from time,p_time_until time,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $fn$
 select private.add_appointment_waitlist(p_org_id,p_branch_id,p_customer_id,p_service_id,p_professional_id,
 p_preferred_from,p_preferred_until,p_time_from,p_time_until,p_notes);
$fn$;

create or replace function private.set_appointment_waitlist_status(
 p_org_id uuid,p_waitlist_id uuid,p_status text,p_appointment_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_row public.appointment_waitlist%rowtype;v_tz text;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para alterar a lista de espera.' using errcode='42501'; end if;
 select * into v_row from public.appointment_waitlist
  where org_id=p_org_id and id=p_waitlist_id for update;
 if not found then raise exception 'Solicitação de espera não encontrada.' using errcode='22023'; end if;
 if v_row.status=p_status and v_row.matched_appointment_id is not distinct from p_appointment_id then return v_row.id; end if;
 if v_row.status in ('cancelled','booked') or p_status not in ('contacted','booked','cancelled')
 then raise exception 'Esta solicitação não admite a alteração solicitada.' using errcode='22023'; end if;
 if p_status='booked' then
   if p_appointment_id is null then raise exception 'Vincule o agendamento confirmado antes de concluir a espera.' using errcode='22023'; end if;
   select o.timezone into v_tz from public.organizations o where o.id=p_org_id;
   if not exists(
    select 1 from public.appointments a
    where a.id=p_appointment_id and a.org_id=p_org_id and a.branch_id=v_row.branch_id
      and a.customer_id=v_row.customer_id and a.service_id=v_row.service_id
      and (v_row.professional_id is null or a.professional_id=v_row.professional_id)
      and a.status in ('scheduled','confirmed','arrived','in_progress','completed')
      and (a.starts_at at time zone v_tz)::date between v_row.preferred_from and v_row.preferred_until
      and (a.starts_at at time zone v_tz)::time>=v_row.time_from
      and (a.ends_at at time zone v_tz)::time<=v_row.time_until
   ) then raise exception 'O agendamento não corresponde à solicitação de espera.' using errcode='22023'; end if;
 elsif p_appointment_id is not null then
   raise exception 'Somente solicitações agendadas podem ter um atendimento vinculado.' using errcode='22023';
 end if;
 update public.appointment_waitlist set status=p_status,matched_appointment_id=p_appointment_id,updated_at=now()
 where org_id=p_org_id and id=v_row.id;
 return v_row.id;
end;
$fn$;
create or replace function public.set_appointment_waitlist_status(
 p_org_id uuid,p_waitlist_id uuid,p_status text,p_appointment_id uuid default null)
returns uuid language sql security invoker set search_path='' as $fn$
 select private.set_appointment_waitlist_status(p_org_id,p_waitlist_id,p_status,p_appointment_id);
$fn$;

create or replace function private.list_appointment_waitlist(
 p_org_id uuid,p_branch_id uuid,p_offset integer default 0,p_limit integer default 50)
returns table(waitlist_id uuid,customer_id uuid,customer_name text,customer_phone text,
 service_id uuid,service_name text,professional_id uuid,professional_name text,
 preferred_from date,preferred_until date,time_from time,time_until time,
 status text,notes text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para consultar a lista de espera.' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
 then raise exception 'Paginação da lista de espera inválida.' using errcode='22023'; end if;
 return query
 select w.id,w.customer_id,c.name,c.phone,w.service_id,s.name,w.professional_id,p.name,
  w.preferred_from,w.preferred_until,w.time_from,w.time_until,w.status,w.notes,w.created_at
 from public.appointment_waitlist w
 join public.customers c on c.org_id=w.org_id and c.id=w.customer_id
 join public.services s on s.org_id=w.org_id and s.id=w.service_id
 left join public.professionals p on p.org_id=w.org_id and p.id=w.professional_id
 where w.org_id=p_org_id and w.branch_id=p_branch_id
 order by w.created_at desc,w.id desc
 limit p_limit offset p_offset;
end;
$fn$;
create or replace function public.list_appointment_waitlist(
 p_org_id uuid,p_branch_id uuid,p_offset integer default 0,p_limit integer default 50)
returns table(waitlist_id uuid,customer_id uuid,customer_name text,customer_phone text,
 service_id uuid,service_name text,professional_id uuid,professional_name text,
 preferred_from date,preferred_until date,time_from time,time_until time,
 status text,notes text,created_at timestamptz)
language sql stable security invoker set search_path='' as $fn$
 select * from private.list_appointment_waitlist(p_org_id,p_branch_id,p_offset,p_limit);
$fn$;

create or replace function private.find_appointment_waitlist_openings(
 p_org_id uuid,p_branch_id uuid,p_date date,p_limit integer default 20)
returns table(waitlist_id uuid,customer_id uuid,customer_name text,service_id uuid,service_name text,
 professional_id uuid,professional_name text,starts_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$
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
   and ((s.starts_at at time zone v_tz)+make_interval(mins=>svc.duration_minutes))::time<=w.time_until
 order by w.created_at,s.starts_at,w.id limit p_limit;
end;
$fn$;
create or replace function public.find_appointment_waitlist_openings(
 p_org_id uuid,p_branch_id uuid,p_date date,p_limit integer default 20)
returns table(waitlist_id uuid,customer_id uuid,customer_name text,service_id uuid,service_name text,
 professional_id uuid,professional_name text,starts_at timestamptz)
language sql stable security invoker set search_path='' as $fn$
 select * from private.find_appointment_waitlist_openings(p_org_id,p_branch_id,p_date,p_limit);
$fn$;

revoke all on function private.save_service_package(uuid,uuid,text,text,numeric,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_service_package(uuid,uuid,text,text,numeric,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.set_service_package_active(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.set_service_package_active(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function private.add_appointment_waitlist(uuid,uuid,uuid,uuid,uuid,date,date,time,time,text) from public,anon,authenticated;
revoke all on function public.add_appointment_waitlist(uuid,uuid,uuid,uuid,uuid,date,date,time,time,text) from public,anon,authenticated;
revoke all on function private.set_appointment_waitlist_status(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.set_appointment_waitlist_status(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function private.list_appointment_waitlist(uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.list_appointment_waitlist(uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function private.find_appointment_waitlist_openings(uuid,uuid,date,integer) from public,anon,authenticated;
revoke all on function public.find_appointment_waitlist_openings(uuid,uuid,date,integer) from public,anon,authenticated;
grant execute on function private.save_service_package(uuid,uuid,text,text,numeric,jsonb,uuid) to authenticated;
grant execute on function public.save_service_package(uuid,uuid,text,text,numeric,jsonb,uuid) to authenticated;
grant execute on function private.set_service_package_active(uuid,uuid,boolean) to authenticated;
grant execute on function public.set_service_package_active(uuid,uuid,boolean) to authenticated;
grant execute on function private.add_appointment_waitlist(uuid,uuid,uuid,uuid,uuid,date,date,time,time,text) to authenticated;
grant execute on function public.add_appointment_waitlist(uuid,uuid,uuid,uuid,uuid,date,date,time,time,text) to authenticated;
grant execute on function private.set_appointment_waitlist_status(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.set_appointment_waitlist_status(uuid,uuid,text,uuid) to authenticated;
grant execute on function private.list_appointment_waitlist(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.list_appointment_waitlist(uuid,uuid,integer,integer) to authenticated;
grant execute on function private.find_appointment_waitlist_openings(uuid,uuid,date,integer) to authenticated;
grant execute on function public.find_appointment_waitlist_openings(uuid,uuid,date,integer) to authenticated;
commit;
