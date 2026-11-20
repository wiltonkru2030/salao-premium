-- Identidade profissional ativa, com acesso habilitado, verificada a cada consulta.
CREATE OR REPLACE FUNCTION private.current_professional_id(target_org uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p.id from public.professionals p
 join public.org_memberships m on m.org_id=p.org_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='professional'
 where p.org_id=target_org and p.profile_id=(select auth.uid()) and p.active=true and p.access_enabled=true
 limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.professional_app_profile_id(target_org uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p.id from public.professionals p
 join public.org_memberships m on m.org_id=p.org_id and m.user_id=(select auth.uid()) and m.status='active'
 where p.org_id=target_org and p.profile_id=(select auth.uid()) and p.active=true and p.access_enabled=true
 and (m.role='professional' or (m.role<>'professional' and m.professional_app_enabled=true and m.professional_app_scope='self'))
 limit 1;
$function$;
comment on function private.current_professional_id(uuid) is 'Identidade profissional ativa e com acesso habilitado; a revogação é verificada a cada consulta.';
comment on function private.professional_app_profile_id(uuid) is 'Perfil individual autorizado e habilitado para o app profissional.';
