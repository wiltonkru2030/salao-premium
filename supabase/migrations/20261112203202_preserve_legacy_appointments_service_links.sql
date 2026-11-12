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

  if tg_op = 'UPDATE'
     and new.professional_id is not distinct from old.professional_id
     and new.service_id is not distinct from old.service_id
     and new.org_id is not distinct from old.org_id then
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
