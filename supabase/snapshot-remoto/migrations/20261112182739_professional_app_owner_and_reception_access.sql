
create or replace function public.set_professional_app_access(
  p_target_user_id uuid,
  p_enabled boolean,
  p_scope text default 'calendar_all'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  select m.org_id into v_org
  from public.org_memberships m
  where m.user_id=auth.uid() and m.status='active'
    and m.role in ('owner','admin')
  order by m.created_at
  limit 1;

  if v_org is null then
    raise exception 'Somente proprietário ou administrador pode liberar acessos.';
  end if;

  select m.role into v_role
  from public.org_memberships m
  where m.org_id=v_org and m.user_id=p_target_user_id and m.status='active'
  for update;

  if v_role is null then
    raise exception 'Usuário não pertence a este salão.';
  end if;

  if v_role in ('owner','admin') then
    if p_target_user_id <> auth.uid() then
      raise exception 'O administrador só pode liberar o próprio acesso ao App.';
    end if;
    if p_enabled and p_scope <> 'all' then
      raise exception 'Proprietário e administrador precisam do escopo completo.';
    end if;
  elsif v_role='receptionist' then
    if p_scope not in ('self','calendar_all') then
      raise exception 'A recepção pode receber apenas escopo individual ou agenda completa.';
    end if;
  else
    raise exception 'A liberação é destinada à recepção e ao próprio proprietário/administrador. Profissionais usam o acesso vinculado ao cadastro.';
  end if;

  update public.org_memberships
     set professional_app_enabled=p_enabled,
         professional_app_scope=case when p_enabled then p_scope else 'self' end
   where org_id=v_org and user_id=p_target_user_id;

  return jsonb_build_object(
    'enabled',p_enabled,
    'scope',case when p_enabled then p_scope else 'none' end,
    'user_id',p_target_user_id
  );
end;
$function$;

revoke all on function public.set_professional_app_access(uuid,boolean,text) from public, anon;
grant execute on function public.set_professional_app_access(uuid,boolean,text) to authenticated, service_role;
