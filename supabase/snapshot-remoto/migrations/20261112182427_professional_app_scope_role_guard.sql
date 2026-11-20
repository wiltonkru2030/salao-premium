create or replace function private.professional_app_scope(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when m.role='professional' then
      case when exists (
        select 1 from public.professionals p
        where p.org_id=m.org_id and p.profile_id=m.user_id
          and p.active=true and p.access_enabled=true
      ) then 'self' else 'none' end
    when m.professional_app_enabled=true
      and m.professional_app_scope = any(array['self','calendar_all','all']::text[])
      then m.professional_app_scope
    else 'none'
  end
  from public.org_memberships m
  where m.org_id=target_org and m.user_id=(select auth.uid()) and m.status='active'
  limit 1;
$function$;
revoke all on function private.professional_app_scope(uuid) from public, anon;
grant execute on function private.professional_app_scope(uuid) to authenticated, service_role;
