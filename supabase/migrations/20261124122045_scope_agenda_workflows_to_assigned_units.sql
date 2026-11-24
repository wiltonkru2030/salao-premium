-- Aplica o escopo de unidade a espera, encaixes e início de atendimento.
-- Preserva a autorização atual de cada operação e acrescenta o vínculo de unidade.
begin;

create policy appointment_waitlist_staff_branch_scope on public.appointment_waitlist
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy appointment_groups_staff_branch_scope on public.appointment_groups
as restrictive for all to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
)
with check (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

CREATE OR REPLACE FUNCTION private.list_appointment_waitlist(p_org_id uuid, p_branch_id uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS TABLE(waitlist_id uuid, customer_id uuid, customer_name text, customer_phone text, service_id uuid, service_name text, professional_id uuid, professional_name text, preferred_from date, preferred_until date, time_from time without time zone, time_until time without time zone, status text, notes text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para consultar a lista de espera.' using errcode='42501'; end if;
 if private.has_org_role(p_org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(p_org_id, p_branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
 then raise exception 'Paginação da lista de espera inválida.' using errcode='22023'; end if;
 return query
 select w.id,w.customer_id,c.name,c.phone,w.service_id,s.name,w.professional_id,p.name,
  w.preferred_from,w.preferred_until,w.time_from,w.time_until,w.status,w.notes,w.created_at
 from public.appointment_waitlist w
 join public.customers c on c.org_id=w.org_id and c.id=w.customer_id
  and (not private.has_org_role(c.org_id, array['manager','receptionist'])
      or private.has_staff_branch_scope(c.org_id, c.branch_id))
 join public.services s on s.org_id=w.org_id and s.id=w.service_id
 left join public.professionals p on p.org_id=w.org_id and p.id=w.professional_id
 where w.org_id=p_org_id and w.branch_id=p_branch_id
 order by w.created_at desc,w.id desc
 limit p_limit offset p_offset;
end;
$function$;

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
 if private.has_org_role(p_org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(p_org_id, p_branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
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
  and (not private.has_org_role(c.org_id, array['manager','receptionist'])
      or private.has_staff_branch_scope(c.org_id, c.branch_id))
 join public.services svc on svc.org_id=w.org_id and svc.id=w.service_id and svc.active
 cross join lateral private.get_customer_available_slots(
  w.org_id,w.branch_id,w.service_id,p_date,w.professional_id,15) s
 where (s.starts_at at time zone v_tz)::time>=w.time_from
   and ((s.starts_at at time zone v_tz)+make_interval(mins=>svc.duration_minutes))::date=p_date
   and ((s.starts_at at time zone v_tz)+make_interval(mins=>svc.duration_minutes))::time<=w.time_until
 order by w.created_at,s.starts_at,w.id limit p_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION private.add_appointment_waitlist(p_org_id uuid, p_branch_id uuid, p_customer_id uuid, p_service_id uuid, p_professional_id uuid, p_preferred_from date, p_preferred_until date, p_time_from time without time zone, p_time_until time without time zone, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_timezone text;v_today date;v_duration integer;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para registrar a lista de espera.' using errcode='42501'; end if;
 if private.has_org_role(p_org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(p_org_id, p_branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
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
 if not exists(select 1 from public.customers c where c.org_id=p_org_id and c.id=p_customer_id and c.active
  and (not private.has_org_role(c.org_id, array['manager','receptionist'])
      or private.has_staff_branch_scope(c.org_id, c.branch_id)))
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
$function$;

CREATE OR REPLACE FUNCTION private.set_appointment_waitlist_status(p_org_id uuid, p_waitlist_id uuid, p_status text, p_appointment_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.appointment_waitlist%rowtype;v_tz text;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para alterar a lista de espera.' using errcode='42501'; end if;
 select * into v_row from public.appointment_waitlist
  where org_id=p_org_id and id=p_waitlist_id for update;
 if not found then raise exception 'Solicitação de espera não encontrada.' using errcode='22023'; end if;
 if private.has_org_role(p_org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(p_org_id, v_row.branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
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
$function$;

CREATE OR REPLACE FUNCTION private.book_appointment_from_waitlist(p_org_id uuid, p_waitlist_id uuid, p_professional_id uuid, p_starts_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_wait public.appointment_waitlist%rowtype;
 v_customer public.customers%rowtype;
 v_service public.services%rowtype;
 v_professional public.professionals%rowtype;
 v_timezone text;
 v_date date;
 v_end timestamptz;
 v_appointment_id uuid;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']),false)
 then raise exception 'Sem permissão para criar encaixes.' using errcode='42501'; end if;
 if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at<=clock_timestamp() or p_professional_id is null
 then raise exception 'Selecione um horário futuro válido.' using errcode='22023'; end if;
 select * into v_wait from public.appointment_waitlist
 where org_id=p_org_id and id=p_waitlist_id for update;
 if not found then raise exception 'Solicitação de espera não encontrada.' using errcode='22023'; end if;
 if private.has_org_role(p_org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(p_org_id, v_wait.branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
 if v_wait.status='booked' and v_wait.matched_appointment_id is not null then
   select a.id into v_appointment_id from public.appointments a
   where a.id=v_wait.matched_appointment_id and a.org_id=p_org_id and a.professional_id=p_professional_id
     and a.starts_at=p_starts_at and a.status not in ('cancelled','no_show');
   if found then return v_appointment_id; end if;
   raise exception 'Esta solicitação já foi agendada. Consulte a Agenda.' using errcode='23505';
 end if;
 if v_wait.status not in ('waiting','contacted') then
   raise exception 'Esta solicitação não está mais aguardando encaixe.' using errcode='22023'; end if;
 if v_wait.professional_id is not null and v_wait.professional_id<>p_professional_id
 then raise exception 'A profissional selecionada é diferente da preferência da cliente.' using errcode='22023'; end if;
 select timezone into v_timezone from public.organizations where id=p_org_id;
 if not found then raise exception 'Organização inválida.' using errcode='22023'; end if;
 v_date:=(p_starts_at at time zone v_timezone)::date;
 if v_date not between v_wait.preferred_from and v_wait.preferred_until
 then raise exception 'O horário está fora das datas solicitadas.' using errcode='22023'; end if;
 select * into v_service from public.services s
 where s.org_id=p_org_id and s.id=v_wait.service_id and s.active
   and (s.branch_id is null or s.branch_id=v_wait.branch_id);
 if not found then raise exception 'O serviço não está disponível nesta unidade.' using errcode='22023'; end if;
 v_end:=p_starts_at+make_interval(mins=>v_service.duration_minutes);
 if (p_starts_at at time zone v_timezone)::time<v_wait.time_from
   or (v_end at time zone v_timezone)::date<>v_date
   or (v_end at time zone v_timezone)::time>v_wait.time_until
 then raise exception 'O horário está fora da janela solicitada.' using errcode='22023'; end if;
 select * into v_customer from public.customers c
 where c.org_id=p_org_id and c.id=v_wait.customer_id and c.active
   and (not private.has_org_role(c.org_id, array['manager','receptionist'])
      or private.has_staff_branch_scope(c.org_id, c.branch_id));
 if not found then raise exception 'A cliente não está ativa.' using errcode='22023'; end if;
 select * into v_professional from public.professionals p
 where p.org_id=p_org_id and p.id=p_professional_id and p.active
   and (p.branch_id is null or p.branch_id=v_wait.branch_id)
   and exists(select 1 from public.professional_services ps
     where ps.org_id=p_org_id and ps.professional_id=p.id and ps.service_id=v_wait.service_id);
 if not found then raise exception 'Profissional indisponível para este serviço.' using errcode='22023'; end if;
 if not exists(
  select 1 from private.get_customer_available_slots(
    p_org_id,v_wait.branch_id,v_wait.service_id,v_date,p_professional_id,15) slot
  where slot.starts_at=p_starts_at and slot.professional_id=p_professional_id
 ) then raise exception 'O horário deixou de estar disponível. Consulte novamente.' using errcode='23P01'; end if;

 insert into public.appointments(
  org_id,branch_id,customer_id,professional_id,service_id,
  customer_name,customer_phone,service_name,professional_name,starts_at,ends_at,
  price,status,booking_source,created_by,comanda_strategy,notes)
 values(
  p_org_id,v_wait.branch_id,v_wait.customer_id,p_professional_id,v_wait.service_id,
  v_customer.name,v_customer.phone,v_service.name,v_professional.name,p_starts_at,v_end,
  v_service.price,'scheduled','salon',(select auth.uid()),'new_on_arrival',
  'Encaixe da lista de espera'
 ) returning id into v_appointment_id;

 update public.appointment_waitlist
 set status='booked',matched_appointment_id=v_appointment_id,updated_at=clock_timestamp()
 where org_id=p_org_id and id=v_wait.id;
 return v_appointment_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.start_appointment_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_appt public.appointments%rowtype; v_order public.service_orders%rowtype; v_created boolean:=false; v_user uuid:=(select auth.uid());
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_appt from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
 if private.has_org_role(v_appt.org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(v_appt.org_id, v_appt.branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
  if not coalesce((
    private.has_org_role(v_appt.org_id,array['owner','admin','manager','receptionist'])
    or private.professional_app_scope(v_appt.org_id)='all'
    or v_appt.professional_id=private.current_professional_id(v_appt.org_id)
  ),false) then raise exception 'Sem permissão para iniciar este atendimento.'; end if;
  if v_appt.status in ('cancelled','completed','no_show') then raise exception 'Este agendamento não pode iniciar atendimento.'; end if;
  if v_appt.service_id is null then raise exception 'Vincule um serviço ao agendamento antes de iniciar.'; end if;
  if p_existing_order_id is not null then
    select * into v_order from public.service_orders
     where org_id=v_appt.org_id and id=p_existing_order_id and customer_id=v_appt.customer_id
       and status in ('open','in_progress','partially_paid','awaiting_payment') for update;
    if not found then raise exception 'A comanda selecionada não está aberta para este cliente.'; end if;
  elsif not p_force_new and v_appt.service_order_id is not null then
    select * into v_order from public.service_orders where org_id=v_appt.org_id and id=v_appt.service_order_id
      and status in ('open','in_progress','partially_paid','awaiting_payment') for update;
  end if;
  if v_order.id is not null then
   if private.has_org_role(v_order.org_id, array['manager','receptionist'])
      and not private.has_staff_branch_scope(v_order.org_id, v_order.branch_id) then
     raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
   end if;
  end if;
  if v_order.id is null then
    insert into public.service_orders(org_id,branch_id,customer_id,appointment_id,assigned_professional_id,status,notes,created_by,created_by_type)
    values(v_appt.org_id,v_appt.branch_id,v_appt.customer_id,v_appt.id,v_appt.professional_id,'in_progress',
      v_appt.notes,v_user,case when private.has_org_role(v_appt.org_id,array['professional']) then 'professional' else 'salon' end)
    returning * into v_order;
    v_created:=true;
  else
    update public.service_orders set status='in_progress',updated_at=now()
     where id=v_order.id and org_id=v_order.org_id returning * into v_order;
  end if;
  if not exists(select 1 from public.service_order_items where org_id=v_appt.org_id and source_appointment_id=v_appt.id) then
    insert into public.service_order_items(org_id,order_id,item_type,service_id,professional_id,source_appointment_id,description,quantity,unit_price,discount,total,performed_at,created_by)
    values(v_appt.org_id,v_order.id,'service',v_appt.service_id,v_appt.professional_id,v_appt.id,
      v_appt.service_name,1,v_appt.price,0,v_appt.price,now(),v_user);
  end if;
  update public.appointments set service_order_id=v_order.id,
    comanda_strategy=case when v_created then 'new_on_arrival' else 'reuse_open' end,
    status='in_progress',arrived_at=coalesce(arrived_at,now()),updated_at=now()
   where org_id=v_appt.org_id and id=v_appt.id;
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'created',v_created,'reused',not v_created,'status',v_order.status);
end;
$function$;

CREATE OR REPLACE FUNCTION private.start_appointment_group_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_first public.appointments%rowtype;v_row record;v_existing uuid:=p_existing_order_id;v_distinct integer;v_result jsonb;v_count integer:=0;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 select * into v_first from public.appointments where id=p_appointment_id;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
 if private.has_org_role(v_first.org_id, array['manager','receptionist'])
    and not private.has_staff_branch_scope(v_first.org_id, v_first.branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
 if v_first.appointment_group_id is null then return public.start_appointment_service_order(p_appointment_id,p_existing_order_id,p_force_new); end if;
 if not coalesce((private.has_org_role(v_first.org_id,array['owner','admin','manager','receptionist'])
   or private.professional_app_scope(v_first.org_id)='all'
   or v_first.professional_id=private.current_professional_id(v_first.org_id)),false) then
  raise exception 'Sem permissão para iniciar este atendimento.';
 end if;
 if private.has_org_role(v_first.org_id, array['manager','receptionist']) and exists (
   select 1 from public.appointments member
   where member.org_id=v_first.org_id and member.appointment_group_id=v_first.appointment_group_id
     and member.status not in ('cancelled','completed','no_show')
     and not private.has_staff_branch_scope(member.org_id, member.branch_id)
 ) then raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501'; end if;
 select count(distinct service_order_id) into v_distinct from public.appointments
  where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show');
 if v_distinct>1 then raise exception 'Os serviços deste grupo já estão ligados a comandas diferentes. Revise os vínculos antes de continuar.'; end if;
 if v_existing is null and not p_force_new then
  select service_order_id into v_existing from public.appointments
   where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show')
   limit 1;
 end if;
 if p_existing_order_id is not null and v_existing is not null and p_existing_order_id<>v_existing then raise exception 'A comanda escolhida não corresponde ao grupo de atendimento.'; end if;
 for v_row in select id from public.appointments where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id
   and status not in ('cancelled','completed','no_show') order by starts_at,id for update
 loop
  v_result:=public.start_appointment_service_order(v_row.id,v_existing,case when v_count=0 then p_force_new else false end);
  v_existing:=(v_result->>'order_id')::uuid;v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Não há serviços ativos neste atendimento.'; end if;
 update public.appointment_groups set status='in_progress',updated_at=now() where org_id=v_first.org_id and id=v_first.appointment_group_id;
 return v_result||jsonb_build_object('service_count',v_count,'group_id',v_first.appointment_group_id);
end;
$function$;

commit;
