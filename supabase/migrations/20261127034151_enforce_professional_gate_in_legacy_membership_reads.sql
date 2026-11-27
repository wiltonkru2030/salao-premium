-- Impede que políticas antigas de membro ignorem a senha provisória ou o acesso revogado.
-- Perfis/vínculos próprios continuam disponíveis para diagnóstico de login.
create or replace function private.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.org_memberships m
  where m.org_id=target_org and m.user_id=(select auth.uid()) and m.status='active'
    and (m.role<>'professional' or private.current_professional_id(target_org) is not null)
 )
$$;
;
