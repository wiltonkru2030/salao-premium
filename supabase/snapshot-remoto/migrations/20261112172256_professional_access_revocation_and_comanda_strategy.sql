
alter table public.appointments
  drop constraint if exists appointments_comanda_strategy_check;
alter table public.appointments
  add constraint appointments_comanda_strategy_check
  check(comanda_strategy in ('new_on_arrival','reuse_open','force_new_on_arrival'));
comment on column public.appointments.comanda_strategy is
  'Regra de comanda na chegada: nova, reutilizar uma em aberto, ou forçar nova apesar de outras comandas abertas.';

create or replace function private.set_professional_membership_default_scope()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.role='professional' then
    new.professional_app_enabled:=true;
    new.professional_app_scope:='self';
  elsif old.role='professional' and new.role<>'professional' then
    new.professional_app_enabled:=false;
    new.professional_app_scope:='self';
  end if;
  return new;
end;
$$;
drop trigger if exists org_memberships_professional_app_defaults on public.org_memberships;
create trigger org_memberships_professional_app_defaults
before insert or update of role on public.org_memberships
for each row execute function private.set_professional_membership_default_scope();

create or replace function public.revoke_professional_app_access(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_user uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select m.org_id into v_org from public.org_memberships m
   where m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin')
   order by m.created_at limit 1;
  if v_org is null then raise exception 'Somente proprietário ou administrador pode desativar o acesso.'; end if;
  select p.profile_id into v_user from public.professionals p
   where p.org_id=v_org and p.id=p_professional_id for update;
  if not found then raise exception 'Profissional não encontrado neste salão.'; end if;
  update public.professionals set access_enabled=false,updated_at=now()
   where org_id=v_org and id=p_professional_id;
  if v_user is not null then
    update public.org_memberships set professional_app_enabled=false,professional_app_scope='self'
     where org_id=v_org and user_id=v_user and role='professional';
    update private.professional_login_identities set enabled=false,updated_at=now()
     where org_id=v_org and professional_id=p_professional_id;
  end if;
  return jsonb_build_object('success',true,'professional_id',p_professional_id);
end;
$$;
revoke all on function public.revoke_professional_app_access(uuid) from public,anon;
grant execute on function public.revoke_professional_app_access(uuid) to authenticated;
