-- SALÃO PREMIUM — auditoria e recuperação de alterações da vitrine pública.
-- Responsabilidade:
--   - Registrar INSERT/UPDATE/DELETE dos perfis públicos em audit_events.
--   - Guardar a linha anterior em recycle_bin em caso de DELETE.
--   - Identificar corretamente tabelas com chave composta (org_id/branch_id) e perfis
--     sem coluna id (slug), sem alterar a identificação das demais tabelas auditadas.
-- Segurança: reutiliza a função privada SECURITY DEFINER já usada pelo sistema.

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
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_data := v_old;
    v_action := 'DELETE';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_data := v_new;
    v_action := 'UPDATE';
  else
    v_new := to_jsonb(new);
    v_data := v_new;
    v_action := 'INSERT';
  end if;

  v_org_id := nullif(v_data->>'org_id','')::uuid;
  if v_org_id is null and tg_table_name = 'organizations' then
    v_org_id := nullif(v_data->>'id','')::uuid;
  elsif v_org_id is null and tg_table_name = 'profiles' then
    select m.org_id into v_org_id
      from public.org_memberships m
     where m.user_id = nullif(v_data->>'id','')::uuid
     order by m.created_at
     limit 1;
  end if;

  -- id cobre tabelas convencionais; branch_id/slug/org_id cobrem chaves sem coluna id.
  v_record_id := coalesce(
    v_data->>'id',
    v_data->>'branch_id',
    v_data->>'slug',
    v_data->>'user_id',
    v_data->>'org_id',
    'unknown'
  );

  if v_org_id is not null and v_actor is not null then
    select m.role into v_role
      from public.org_memberships m
     where m.org_id = v_org_id and m.user_id = v_actor and m.status = 'active'
     limit 1;
  end if;

  v_desc := case v_action
    when 'INSERT' then 'Registro criado em ' || tg_table_name
    when 'UPDATE' then 'Registro atualizado em ' || tg_table_name
    else 'Registro excluído de ' || tg_table_name
  end;

  if v_action = 'DELETE' then
    v_group := nullif(current_setting('app.recycle_group',true),'')::uuid;
    if v_group is null then
      v_group := gen_random_uuid();
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

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

comment on function private.capture_row_audit() is
  'Audita INSERT/UPDATE/DELETE em audit_events e preserva OLD em recycle_bin; suporta chaves id, branch_id, slug e org_id.';

drop trigger if exists audit_row_change on public.salon_public_profiles;
create trigger audit_row_change
  after insert or update or delete on public.salon_public_profiles
  for each row execute function private.capture_row_audit();

drop trigger if exists audit_row_change on public.branch_public_profiles;
create trigger audit_row_change
  after insert or update or delete on public.branch_public_profiles
  for each row execute function private.capture_row_audit();

commit;
