
alter table public.org_memberships
  drop constraint if exists org_memberships_professional_app_scope_check;
alter table public.org_memberships
  add constraint org_memberships_professional_app_scope_check
  check (professional_app_scope in ('self','calendar_all','all'));

create or replace function private.professional_app_scope(target_org uuid)
returns text language sql stable security definer set search_path=''
as $$
  select case
    when m.role in ('owner','admin') then 'all'
    when m.role='professional' and exists(
      select 1 from public.professionals p
       where p.org_id=m.org_id and p.profile_id=m.user_id
         and p.active=true and p.access_enabled=true
    ) then 'self'
    when m.professional_app_enabled and m.professional_app_scope in ('self','calendar_all','all')
      then m.professional_app_scope
    else 'none'
  end
  from public.org_memberships m
  where m.org_id=target_org and m.user_id=(select auth.uid()) and m.status='active'
  limit 1;
$$;
revoke all on function private.professional_app_scope(uuid) from public,anon;
grant execute on function private.professional_app_scope(uuid) to authenticated,service_role;

drop policy if exists profiles_select_org_admin on public.profiles;
create policy profiles_select_org_admin
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.org_memberships target
    where target.user_id=profiles.id and target.status='active'
      and private.has_org_role(target.org_id,array['owner','admin','manager'])
  )
);

create or replace function public.set_professional_app_access(
  p_target_user_id uuid,
  p_enabled boolean,
  p_scope text default 'calendar_all'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  if p_scope not in ('self','calendar_all') then
    raise exception 'O escopo autorizado deve ser individual ou agenda completa.';
  end if;
  select m.org_id into v_org
    from public.org_memberships m
   where m.user_id=auth.uid() and m.status='active'
     and m.role in ('owner','admin')
   order by m.created_at limit 1;
  if v_org is null then raise exception 'Somente proprietário ou administrador pode liberar acessos.'; end if;
  select role into v_role
    from public.org_memberships
   where org_id=v_org and user_id=p_target_user_id and status='active'
   for update;
  if v_role is null then raise exception 'Usuário não pertence a este salão.'; end if;
  if v_role not in ('receptionist') then
    raise exception 'Esta liberação é destinada ao perfil da recepção. Profissionais usam o acesso vinculado ao próprio cadastro.';
  end if;
  update public.org_memberships
     set professional_app_enabled=p_enabled,
         professional_app_scope=case when p_enabled then p_scope else 'self' end
   where org_id=v_org and user_id=p_target_user_id;
  return jsonb_build_object('enabled',p_enabled,'scope',case when p_enabled then p_scope else 'none' end);
end;
$$;
revoke all on function public.set_professional_app_access(uuid,boolean,text) from public,anon;
grant execute on function public.set_professional_app_access(uuid,boolean,text) to authenticated;

drop trigger if exists audit_row_change on public.service_order_payments;
create trigger audit_row_change
after insert or update or delete on public.service_order_payments
for each row execute function private.capture_row_audit();

drop trigger if exists audit_row_change on public.profiles;
create trigger audit_row_change
after insert or update or delete on public.profiles
for each row execute function private.capture_row_audit();

create or replace function private.purge_expired_recycle_bin()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare removed_rows integer:=0; scrubbed_rows integer:=0;
begin
  delete from public.recycle_bin where expires_at<=clock_timestamp();
  get diagnostics removed_rows=row_count;

  update public.audit_events e
     set before_data=null,after_data=null
   where (e.before_data is not null or e.after_data is not null)
     and exists (
       select 1 from public.audit_events d
       where d.table_name=e.table_name
         and d.record_id=e.record_id
         and d.org_id is not distinct from e.org_id
         and d.action='DELETE'
         and d.occurred_at<=clock_timestamp()-interval '30 days'
     );
  get diagnostics scrubbed_rows=row_count;
  return jsonb_build_object(
    'recycle_rows_removed',removed_rows,
    'audit_entity_snapshots_scrubbed',scrubbed_rows
  );
end;
$$;
revoke all on function private.purge_expired_recycle_bin() from public,anon,authenticated;
