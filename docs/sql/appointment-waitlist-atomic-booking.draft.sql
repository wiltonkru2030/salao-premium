-- Reserva uma vaga real da lista de espera e marca seu consumo na mesma transação.
-- A validação de disponibilidade, gatilhos de sobreposição e RLS da agenda permanecem aplicáveis.
begin;
create or replace function private.book_appointment_from_waitlist(
 p_org_id uuid,p_waitlist_id uuid,p_professional_id uuid,p_starts_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $fn$
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
 where c.org_id=p_org_id and c.id=v_wait.customer_id and c.active;
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
$fn$;
create or replace function public.book_appointment_from_waitlist(
 p_org_id uuid,p_waitlist_id uuid,p_professional_id uuid,p_starts_at timestamptz)
returns uuid language sql security invoker set search_path='' as $fn$
 select private.book_appointment_from_waitlist(p_org_id,p_waitlist_id,p_professional_id,p_starts_at);
$fn$;
revoke all on function private.book_appointment_from_waitlist(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.book_appointment_from_waitlist(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.book_appointment_from_waitlist(uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.book_appointment_from_waitlist(uuid,uuid,uuid,timestamptz) to authenticated;

-- Se o agendamento de encaixe foi cancelado, volta a aguardar somente dentro do prazo.
create or replace function private.release_cancelled_waitlist_appointment()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_today date;v_timezone text;
begin
 if new.status<>'cancelled' or old.status='cancelled' then return new; end if;
 select timezone into v_timezone from public.organizations where id=new.org_id;
 v_today:=(now() at time zone v_timezone)::date;
 update public.appointment_waitlist w
 set status=case when w.preferred_until>=v_today then 'waiting' else 'cancelled' end,
  matched_appointment_id=null,updated_at=clock_timestamp()
 where w.org_id=new.org_id and w.matched_appointment_id=new.id and w.status='booked';
 return new;
end;
$fn$;
revoke all on function private.release_cancelled_waitlist_appointment() from public,anon,authenticated;
create trigger release_cancelled_waitlist_appointment
after update of status on public.appointments for each row
when (old.status is distinct from new.status and new.status='cancelled')
execute function private.release_cancelled_waitlist_appointment();
commit;
