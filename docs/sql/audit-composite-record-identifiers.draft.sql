-- RASCUNHO — auditoria de tabelas globais e chaves compostas.
-- Atualiza o identificador de auditoria sem alterar o comportamento das tabelas existentes.
-- Não aplicar em produção sem revisão e autorização explícita.

begin;

create or replace function private.capture_row_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb;
  v_new jsonb;
  v_data jsonb;
  v_org_id uuid;
  v_record_id text;
  v_actor uuid;
  v_role text;
  v_group uuid;
  v_action text;
  v_desc text;
begin
  v_actor := (select auth.uid());

  if tg_op='DELETE' then
    v_old:=to_jsonb(old); v_data:=v_old; v_action:='DELETE';
  elsif tg_op='UPDATE' then
    v_old:=to_jsonb(old); v_new:=to_jsonb(new); v_data:=v_new; v_action:='UPDATE';
  else
    v_new:=to_jsonb(new); v_data:=v_new; v_action:='INSERT';
  end if;

  v_org_id:=nullif(v_data->>'org_id','')::uuid;
  if v_org_id is null and tg_table_name='organizations' then
    v_org_id:=nullif(v_data->>'id','')::uuid;
  elsif v_org_id is null and tg_table_name='profiles' then
    select m.org_id into v_org_id from public.org_memberships m
     where m.user_id=nullif(v_data->>'id','')::uuid order by m.created_at limit 1;
  end if;

  v_record_id:=coalesce(
    v_data->>'id',
    case when v_data ? 'org_id' and v_data ? 'auth_user_id'
      then concat_ws(':',v_data->>'org_id',v_data->>'auth_user_id') end,
    case when v_data ? 'org_id' and v_data ? 'customer_id'
      then concat_ws(':',v_data->>'org_id',v_data->>'customer_id') end,
    case when v_data ? 'org_id' and v_data ? 'branch_id'
      then concat_ws(':',v_data->>'org_id',v_data->>'branch_id') end,
    case when v_data ? 'org_id' and v_data ? 'coupon_id' and v_data ? 'service_id'
      then concat_ws(':',v_data->>'org_id',v_data->>'coupon_id',v_data->>'service_id') end,
    v_data->>'user_id',
    v_data->>'auth_user_id',
    v_data->>'customer_id',
    v_data->>'branch_id',
    v_data->>'coupon_id',
    v_data->>'org_id',
    'unknown'
  );

  if v_org_id is not null and v_actor is not null then
    select m.role into v_role from public.org_memberships m
     where m.org_id=v_org_id and m.user_id=v_actor and m.status='active' limit 1;
  end if;

  v_desc:=case v_action
    when 'INSERT' then 'Registro criado em '||tg_table_name
    when 'UPDATE' then 'Registro atualizado em '||tg_table_name
    else 'Registro excluído de '||tg_table_name
  end;

  if v_action='DELETE' then
    v_group:=nullif(current_setting('app.recycle_group',true),'')::uuid;
    if v_group is null then
      v_group:=gen_random_uuid();
      perform set_config('app.recycle_group',v_group::text,true);
    end if;
    insert into public.recycle_bin(
      org_id,entity_table,entity_id,description,row_data,deleted_by,deleted_role,delete_group
    ) values (
      v_org_id,tg_table_name,v_record_id,v_desc,v_old,v_actor,v_role,v_group
    );
  end if;

  insert into public.audit_events(
    org_id,actor_id,actor_role,action,table_name,record_id,description,before_data,after_data
  ) values (
    v_org_id,v_actor,v_role,v_action,tg_table_name,v_record_id,v_desc,
    case when v_action in ('UPDATE','DELETE') then v_old else null end,
    case when v_action in ('INSERT','UPDATE') then v_new else null end
  );

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function private.capture_row_audit() from public,anon,authenticated;

-- A migration de identidade global criou as tabelas, mas ainda não havia
-- gatilhos genéricos de auditoria/recuperação em todas elas.
drop trigger if exists audit_row_change on public.customer_profiles;
create trigger audit_row_change after insert or update or delete on public.customer_profiles
  for each row execute function private.capture_row_audit();

drop trigger if exists audit_row_change on public.customer_tenant_memberships;
create trigger audit_row_change after insert or update or delete on public.customer_tenant_memberships
  for each row execute function private.capture_row_audit();

drop trigger if exists audit_row_change on public.customer_account_customers;
create trigger audit_row_change after insert or update or delete on public.customer_account_customers
  for each row execute function private.capture_row_audit();

drop trigger if exists audit_row_change on public.customer_identity_link_requests;
create trigger audit_row_change after insert or update or delete on public.customer_identity_link_requests
  for each row execute function private.capture_row_audit();

commit;
