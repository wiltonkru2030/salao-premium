-- Revalida expediente e exceções em toda criação ou alteração de horário na Agenda.
-- A regra é aplicada no banco para não depender da validação do navegador.
create or replace function private.prevent_appointment_overlap()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_timezone text; v_local_start timestamp; v_local_end timestamp; v_weekday integer;
begin
 if new.starts_at is null or new.ends_at is null or new.ends_at<=new.starts_at then
  raise exception 'O horário final deve ser posterior ao horário inicial.' using errcode='22023';
 end if;
 if new.professional_id is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.org_id::text||':'||new.professional_id::text,0));

 if new.status not in ('cancelled','no_show')
 and new.branch_id is not null
 and (tg_op='INSERT' or new.branch_id is distinct from old.branch_id
   or new.professional_id is distinct from old.professional_id
   or new.starts_at is distinct from old.starts_at
   or new.ends_at is distinct from old.ends_at) then
  select o.timezone into v_timezone from public.organizations o
  join public.branches b on b.org_id=o.id and b.id=new.branch_id and b.active
  where o.id=new.org_id;
  if not found then raise exception 'Selecione uma unidade ativa desta organização.' using errcode='23514'; end if;
  if exists(select 1 from public.professionals p where p.org_id=new.org_id and p.id=new.professional_id
    and p.branch_id is not null and p.branch_id<>new.branch_id) then
   raise exception 'O profissional não está vinculado a esta unidade.' using errcode='23514';
  end if;
  v_local_start:=new.starts_at at time zone v_timezone;
  v_local_end:=new.ends_at at time zone v_timezone;
  v_weekday:=extract(dow from v_local_start)::integer;
  if v_local_start::date<>v_local_end::date then
   raise exception 'O atendimento precisa terminar dentro do mesmo expediente.' using errcode='23514';
  end if;
  if not exists(select 1 from public.branch_business_hours h where h.org_id=new.org_id
    and h.branch_id=new.branch_id and h.weekday=v_weekday and h.active
    and h.opens_at<=v_local_start::time and h.closes_at>=v_local_end::time) then
   raise exception 'A unidade não atende durante todo esse horário.' using errcode='23514';
  end if;
  if not exists(select 1 from public.professional_working_hours h where h.org_id=new.org_id
    and h.professional_id=new.professional_id and h.weekday=v_weekday and h.active
    and h.starts_at<=v_local_start::time and h.ends_at>=v_local_end::time) then
   raise exception 'O profissional não trabalha durante todo esse horário.' using errcode='23514';
  end if;
  if exists(select 1 from public.branch_closures c where c.org_id=new.org_id and c.branch_id=new.branch_id
    and new.starts_at<c.ends_at and new.ends_at>c.starts_at) then
   raise exception 'A unidade estará fechada nesse período.' using errcode='23P01';
  end if;
  if exists(select 1 from public.professional_time_off t where t.org_id=new.org_id
    and t.professional_id=new.professional_id and new.starts_at<t.ends_at and new.ends_at>t.starts_at) then
   raise exception 'O profissional não estará disponível nesse período.' using errcode='23P01';
  end if;
 end if;

 if new.status not in ('cancelled','no_show') and exists(select 1 from public.appointments a
  where a.org_id=new.org_id and a.professional_id=new.professional_id and a.id is distinct from new.id
  and a.status not in ('cancelled','no_show') and new.starts_at<a.ends_at and new.ends_at>a.starts_at) then
  raise exception 'Já existe um agendamento deste profissional nesse horário.' using errcode='23P01';
 end if;
 if new.status not in ('cancelled','no_show') and exists(select 1 from public.appointment_blocks b
  where b.org_id=new.org_id and (b.professional_id is null or b.professional_id=new.professional_id)
  and (b.branch_id is null or b.branch_id is not distinct from new.branch_id)
  and new.starts_at<b.ends_at and new.ends_at>b.starts_at) then
  raise exception 'Este horário está bloqueado para o profissional.' using errcode='23P01';
 end if;
 if new.status not in ('cancelled','no_show') and exists(select 1 from public.appointment_holds h
  where h.org_id=new.org_id and h.professional_id=new.professional_id
  and h.id is distinct from new.appointment_hold_id and h.status='active' and h.expires_at>now()
  and new.starts_at<h.ends_at and new.ends_at>h.starts_at) then
  raise exception 'Este horário está temporariamente reservado por outra cliente.' using errcode='23P01';
 end if;
 return new;
end;
$function$;
drop trigger if exists appointments_prevent_overlap on public.appointments;
create trigger appointments_prevent_overlap before insert or update of org_id,branch_id,professional_id,starts_at,ends_at,status
on public.appointments for each row execute function private.prevent_appointment_overlap();
