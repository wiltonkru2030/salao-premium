create or replace function public.enforce_professional_service_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.service_id is null or new.professional_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.professional_services ps
    where ps.org_id = new.org_id
      and ps.professional_id = new.professional_id
      and ps.service_id = new.service_id
  ) then
    raise exception 'Este profissional não está habilitado para atender o serviço selecionado.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_professional_service_assignment() from public, anon;
grant execute on function public.enforce_professional_service_assignment() to authenticated, service_role;

drop trigger if exists appointments_require_professional_service
  on public.appointments;
create trigger appointments_require_professional_service
before insert or update of org_id, professional_id, service_id
on public.appointments
for each row execute function public.enforce_professional_service_assignment();

drop trigger if exists service_order_items_require_professional_service
  on public.service_order_items;
create trigger service_order_items_require_professional_service
before insert or update of org_id, professional_id, service_id, item_type
on public.service_order_items
for each row
when (new.item_type = 'service')
execute function public.enforce_professional_service_assignment();
