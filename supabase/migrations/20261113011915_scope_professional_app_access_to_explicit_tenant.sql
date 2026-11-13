-- Escopa a liberação/revogação do App Profissional à organização informada.
CREATE OR REPLACE FUNCTION public.revoke_professional_app_access(p_org_id uuid, p_professional_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid; v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Autenticação necessária.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin']) then
    raise exception 'Somente proprietário ou administrador desta organização pode desativar o acesso.';
  end if;
  select p.profile_id into v_user
  from public.professionals p
  where p.org_id=p_org_id and p.id=p_professional_id
  for update;
  if not found then raise exception 'Profissional não encontrado nesta organização.'; end if;

  update public.professionals set access_enabled=false,updated_at=clock_timestamp()
  where org_id=p_org_id and id=p_professional_id;
  if v_user is not null then
    update public.org_memberships
    set professional_app_enabled=false,professional_app_scope='self'
    where org_id=p_org_id and user_id=v_user and role='professional';
    update private.professional_login_identities
    set enabled=false,updated_at=clock_timestamp()
    where org_id=p_org_id and professional_id=p_professional_id;
  end if;
  return jsonb_build_object('success',true,'professional_id',p_professional_id,'org_id',p_org_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_professional_app_access(p_org_id uuid, p_target_user_id uuid, p_enabled boolean, p_scope text DEFAULT 'calendar_all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid := (select auth.uid()); v_role text;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin']) then
    raise exception 'Somente proprietário ou administrador desta organização pode liberar acessos.';
  end if;
  select m.role into v_role
  from public.org_memberships m
  where m.org_id=p_org_id and m.user_id=p_target_user_id and m.status='active'
  for update;
  if v_role is null then raise exception 'Usuário não pertence a esta organização.'; end if;

  if v_role in ('owner','admin') then
    if p_target_user_id<>v_user then raise exception 'O administrador só pode liberar o próprio acesso ao App.'; end if;
    if p_enabled and p_scope<>'all' then raise exception 'Proprietário e administrador precisam do escopo completo.'; end if;
  elsif v_role='receptionist' then
    if p_enabled and p_scope<>'calendar_all' then
      raise exception 'Para a recepção, use agenda completa até existir uma conta separada por profissional.';
    end if;
  else
    raise exception 'A liberação é destinada à recepção e ao próprio proprietário/administrador.';
  end if;

  update public.org_memberships
  set professional_app_enabled=p_enabled,
      professional_app_scope=case when p_enabled then p_scope else 'self' end
  where org_id=p_org_id and user_id=p_target_user_id;

  return jsonb_build_object('enabled',p_enabled,'scope',case when p_enabled then p_scope else 'none' end,'user_id',p_target_user_id,'org_id',p_org_id);
end;
$function$
;

revoke all on function public.set_professional_app_access(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.revoke_professional_app_access(uuid) from public,anon,authenticated;
revoke all on function public.set_professional_app_access(uuid,uuid,boolean,text) from public,anon;
revoke all on function public.revoke_professional_app_access(uuid,uuid) from public,anon;
grant execute on function public.set_professional_app_access(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.revoke_professional_app_access(uuid,uuid) to authenticated;
