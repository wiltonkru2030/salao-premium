
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  actor_id uuid,
  actor_role text,
  action text not null check (action in ('INSERT','UPDATE','DELETE','RESTORE','PERMANENT_DELETE')),
  table_name text not null,
  record_id text,
  description text not null,
  before_data jsonb,
  after_data jsonb,
  transaction_id bigint not null default txid_current(),
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists audit_events_org_time_idx on public.audit_events(org_id,occurred_at desc);
create index if not exists audit_events_entity_idx on public.audit_events(org_id,table_name,record_id,occurred_at desc);

create table if not exists public.recycle_bin (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  entity_table text not null,
  entity_id text not null,
  description text not null,
  row_data jsonb not null,
  deleted_by uuid,
  deleted_role text,
  deleted_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '30 days'),
  delete_group uuid not null,
  status text not null default 'active' check (status in ('active','restored')),
  restored_at timestamptz,
  restored_by uuid
);
create index if not exists recycle_bin_org_deleted_idx on public.recycle_bin(org_id,deleted_at desc) where status='active';
create index if not exists recycle_bin_group_idx on public.recycle_bin(delete_group,status,deleted_at);

alter table public.audit_events enable row level security;
alter table public.recycle_bin enable row level security;
drop policy if exists audit_events_select_admin on public.audit_events;
create policy audit_events_select_admin on public.audit_events for select to authenticated
using (org_id is not null and private.has_org_role(org_id,array['owner','admin','manager']));
drop policy if exists recycle_bin_select_admin on public.recycle_bin;
create policy recycle_bin_select_admin on public.recycle_bin for select to authenticated
using (org_id is not null and private.has_org_role(org_id,array['owner','admin']));
grant select on public.audit_events,public.recycle_bin to authenticated;
revoke insert,update,delete on public.audit_events,public.recycle_bin from anon,authenticated;

create or replace function private.capture_row_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_old jsonb; v_new jsonb; v_data jsonb; v_org_id uuid;
  v_record_id text; v_actor uuid; v_role text; v_group uuid; v_action text; v_desc text;
begin
  v_actor:=(select auth.uid());
  if tg_op='DELETE' then v_old:=to_jsonb(old); v_data:=v_old; v_action:='DELETE';
  elsif tg_op='UPDATE' then v_old:=to_jsonb(old); v_new:=to_jsonb(new); v_data:=v_new; v_action:='UPDATE';
  else v_new:=to_jsonb(new); v_data:=v_new; v_action:='INSERT'; end if;
  v_org_id:=nullif(v_data->>'org_id','')::uuid;
  if v_org_id is null and tg_table_name='organizations' then
    v_org_id:=nullif(v_data->>'id','')::uuid;
  elsif v_org_id is null and tg_table_name='profiles' then
    select m.org_id into v_org_id from public.org_memberships m
     where m.user_id=nullif(v_data->>'id','')::uuid order by m.created_at limit 1;
  end if;
  v_record_id:=coalesce(v_data->>'id',v_data->>'user_id','unknown');
  if v_org_id is not null and v_actor is not null then
    select m.role into v_role from public.org_memberships m
     where m.org_id=v_org_id and m.user_id=v_actor and m.status='active' limit 1;
  end if;
  v_desc:=case v_action when 'INSERT' then 'Registro criado em '||tg_table_name
    when 'UPDATE' then 'Registro atualizado em '||tg_table_name
    else 'Registro excluído de '||tg_table_name end;
  if v_action='DELETE' then
    v_group:=nullif(current_setting('app.recycle_group',true),'')::uuid;
    if v_group is null then
      v_group:=gen_random_uuid();
      perform set_config('app.recycle_group',v_group::text,true);
    end if;
    insert into public.recycle_bin(org_id,entity_table,entity_id,description,row_data,deleted_by,deleted_role,delete_group)
    values(v_org_id,tg_table_name,v_record_id,v_desc,v_old,v_actor,v_role,v_group);
  end if;
  insert into public.audit_events(org_id,actor_id,actor_role,action,table_name,record_id,description,before_data,after_data)
  values(v_org_id,v_actor,v_role,v_action,tg_table_name,v_record_id,v_desc,
    case when v_action in ('UPDATE','DELETE') then v_old else null end,
    case when v_action in ('INSERT','UPDATE') then v_new else null end);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.capture_row_audit() from public,anon,authenticated;

do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      join information_schema.columns col on col.table_schema=n.nspname and col.table_name=c.relname and col.column_name='org_id'
     where n.nspname='public' and c.relkind='r'
       and c.relname not in ('audit_logs','audit_events','recycle_bin')
  loop
    execute format('drop trigger if exists audit_row_change on public.%I',r.relname);
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function private.capture_row_audit()',r.relname);
  end loop;
  execute 'drop trigger if exists audit_row_change on public.organizations';
  execute 'create trigger audit_row_change after insert or update or delete on public.organizations for each row execute function private.capture_row_audit()';
end $$;

create or replace function private.restore_recycle_entry(p_entry_id uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v public.recycle_bin%rowtype; v_rows integer;
begin
  select * into v from public.recycle_bin where id=p_entry_id and status='active' for update;
  if not found then return false; end if;
  if v.expires_at<=now() then raise exception 'O prazo de recuperação de 30 dias expirou.'; end if;
  if v.org_id is null or not private.has_org_role(v.org_id,array['owner','admin']) then
    raise exception 'Somente proprietário ou administrador deste salão pode restaurar registros.';
  end if;
  if not exists(select 1 from information_schema.tables t where t.table_schema='public' and t.table_name=v.entity_table) then
    raise exception 'A tabela original não está mais disponível.';
  end if;
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',v.entity_table,v.entity_table)
    using v.row_data;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'O registro não foi restaurado.'; end if;
  update public.recycle_bin set status='restored',restored_at=now(),restored_by=p_actor where id=v.id;
  insert into public.audit_events(org_id,actor_id,actor_role,action,table_name,record_id,description,after_data)
  values(v.org_id,p_actor,'admin','RESTORE',v.entity_table,v.entity_id,'Registro restaurado de Recuperar dados',v.row_data);
  return true;
end;
$$;
revoke all on function private.restore_recycle_entry(uuid,uuid) from public,anon,authenticated;

create or replace function public.restore_recycle_bin_group(p_group_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_entry record; v_restored integer:=0; v_pass integer; v_pass_count integer;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select org_id into v_org from public.recycle_bin where delete_group=p_group_id and status='active' limit 1;
  if v_org is null or not private.has_org_role(v_org,array['owner','admin']) then
    raise exception 'Acesso restrito ao proprietário ou administrador do salão.';
  end if;
  for v_pass in 1..20 loop
    v_pass_count:=0;
    for v_entry in select id from public.recycle_bin where delete_group=p_group_id and status='active' order by deleted_at,id loop
      begin
        if private.restore_recycle_entry(v_entry.id,auth.uid()) then
          v_restored:=v_restored+1; v_pass_count:=v_pass_count+1;
        end if;
      exception when foreign_key_violation or unique_violation then null;
      end;
    end loop;
    exit when not exists(select 1 from public.recycle_bin where delete_group=p_group_id and status='active');
    exit when v_pass_count=0;
  end loop;
  if exists(select 1 from public.recycle_bin where delete_group=p_group_id and status='active') then
    raise exception 'Alguns itens dependem de registros que ainda não puderam ser restaurados.';
  end if;
  return v_restored;
end;
$$;
revoke all on function public.restore_recycle_bin_group(uuid) from public,anon;
grant execute on function public.restore_recycle_bin_group(uuid) to authenticated;

create or replace function public.permanently_delete_recycle_bin_group(p_group_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_count integer;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select org_id into v_org from public.recycle_bin where delete_group=p_group_id and status='active' limit 1;
  if v_org is null or not private.has_org_role(v_org,array['owner','admin']) then
    raise exception 'Acesso restrito ao proprietário ou administrador do salão.';
  end if;
  insert into public.audit_events(org_id,actor_id,actor_role,action,table_name,record_id,description,before_data)
  values(v_org,auth.uid(),'admin','PERMANENT_DELETE','recycle_bin',p_group_id::text,'Grupo removido permanentemente da lixeira',
    (select jsonb_agg(jsonb_build_object('id',id,'table',entity_table,'record_id',entity_id,'description',description))
       from public.recycle_bin where delete_group=p_group_id and status='active'));
  delete from public.recycle_bin where delete_group=p_group_id and status='active';
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.permanently_delete_recycle_bin_group(uuid) from public,anon;
grant execute on function public.permanently_delete_recycle_bin_group(uuid) to authenticated;
