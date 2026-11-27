-- Marca administrativa consultada diretamente no Auth, não no user_metadata editável.
-- Contas legadas sem marcador conservam comportamento até a migração coordenada.
create or replace function private.professional_password_ready()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((
   select case when u.raw_app_meta_data ? 'professional_password_generation'
     then u.raw_app_meta_data->>'professional_password_required'='false'
       and u.raw_app_meta_data->>'professional_password_generation' = auth.jwt()->'app_metadata'->>'professional_password_generation'
     else not coalesce(u.raw_app_meta_data->>'professional_password_required'='true',false) end
   from auth.users u where u.id=(select auth.uid())
 ),false)
$$;
revoke all on function private.professional_password_ready() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.current_professional_id(target_org uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p.id from public.professionals p
 join public.org_memberships m on m.org_id=p.org_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='professional'
 where p.org_id=target_org and p.profile_id=(select auth.uid()) and p.active=true and p.access_enabled=true
 and private.professional_password_ready()
 limit 1;
$function$
;
CREATE OR REPLACE FUNCTION private.has_org_role(target_org uuid, allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists (
  select 1 from public.org_memberships m
  where m.org_id=target_org and m.user_id=(select auth.uid())
    and m.status='active' and m.role=any(allowed_roles)
    and (m.role<>'professional' or private.professional_password_ready())
 );
$function$
;
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
 and private.professional_password_ready()
 limit 1;
$function$
;
CREATE OR REPLACE FUNCTION private.professional_app_scope(target_org uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((
  select case
    when m.role='professional' then case when private.professional_password_ready() and exists (
      select 1 from public.professionals p where p.org_id=m.org_id and p.profile_id=m.user_id and p.active=true and p.access_enabled=true
    ) then 'self' else 'none' end
    when m.professional_app_enabled=true and m.professional_app_scope=any(array['self','calendar_all','all']::text[])
      then m.professional_app_scope
    else 'none' end
  from public.org_memberships m where m.org_id=target_org and m.user_id=(select auth.uid()) and m.status='active' limit 1
 ),'none'::text);
$function$

;
;
