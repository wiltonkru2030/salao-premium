
create or replace function private.bootstrap_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  new_org uuid;
  org_name text;
  full_name text;
  account_type text;
begin
  full_name:=coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'),''),
    split_part(coalesce(new.email,''),'@',1)
  );
  account_type:=coalesce(new.raw_user_meta_data->>'account_type','');

  -- Internal/professional accounts are linked to an existing salon by the
  -- administrator's provisioning flow. They must never receive a new owner tenant.
  if account_type in ('professional','receptionist','staff') then
    insert into public.profiles(id,full_name)
    values(new.id,full_name)
    on conflict(id) do update set full_name=excluded.full_name;
    return new;
  end if;

  org_name:=coalesce(
    nullif(trim(new.raw_user_meta_data->>'organization_name'),''),
    'Meu Salão'
  );
  insert into public.organizations(name) values(org_name) returning id into new_org;
  insert into public.profiles(id,full_name) values(new.id,full_name)
    on conflict(id) do update set full_name=excluded.full_name;
  insert into public.org_memberships(org_id,user_id,role,status)
  values(new_org,new.id,'owner','active');
  insert into public.branches(org_id,name,is_main)
  values(new_org,'Unidade Matriz',true);
  return new;
end;
$$;
