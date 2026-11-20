
alter table public.appointments add column if not exists created_by_name text;

create or replace function private.snapshot_appointment_creator()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.created_by is null then new.created_by:=(select auth.uid()); end if;
  if new.created_by_name is null and new.created_by is not null then
    select p.full_name into new.created_by_name
      from public.profiles p where p.id=new.created_by;
  end if;
  return new;
end;
$$;
drop trigger if exists appointments_creator_snapshot on public.appointments;
create trigger appointments_creator_snapshot
before insert on public.appointments
for each row execute function private.snapshot_appointment_creator();

comment on column public.appointments.booking_source is 'Origem do agendamento: cliente, salão ou profissional.';
comment on column public.appointments.created_by_name is 'Nome do usuário que criou o agendamento, preservado como snapshot para exibição futura.';
