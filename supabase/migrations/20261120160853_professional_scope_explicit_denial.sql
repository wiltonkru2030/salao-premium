CREATE OR REPLACE FUNCTION private.professional_app_scope(target_org uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((
  select case
    when m.role='professional' then case when exists (
      select 1 from public.professionals p where p.org_id=m.org_id and p.profile_id=m.user_id and p.active=true and p.access_enabled=true
    ) then 'self' else 'none' end
    when m.professional_app_enabled=true and m.professional_app_scope=any(array['self','calendar_all','all']::text[])
      then m.professional_app_scope
    else 'none' end
  from public.org_memberships m where m.org_id=target_org and m.user_id=(select auth.uid()) and m.status='active' limit 1
 ),'none'::text);
$function$;
comment on function private.professional_app_scope(uuid) is 'Escopo do app com negação explícita quando não há vínculo autorizado.';
