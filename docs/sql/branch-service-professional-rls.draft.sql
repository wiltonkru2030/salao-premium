-- Candidata para QA: leitura profissional do catálogo exclusivamente por atribuição e unidade.
-- Preserva os papéis administrativos atuais. Não concede acesso por metadados do navegador.
begin;
create or replace function private.professional_can_read_branch_service(p_org_id uuid,p_service_id uuid,p_branch_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
 select exists(
  select 1 from public.professionals p
  join public.professional_services ps on ps.org_id=p.org_id and ps.professional_id=p.id and ps.service_id=p_service_id
  where p.org_id=p_org_id and p.id=private.current_professional_id(p_org_id)
    and (p_branch_id is null or p.branch_id=p_branch_id)
 );
$function$;
revoke all on function private.professional_can_read_branch_service(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.professional_can_read_branch_service(uuid,uuid,uuid) to authenticated;
drop policy if exists services_select_professional_app on public.services;
create policy services_select_professional_app on public.services for select to authenticated
using (
 private.has_org_role(org_id,array['owner','admin','manager','receptionist'])
 or (private.professional_app_scope(org_id)='self'
     and private.professional_can_read_branch_service(org_id,id,branch_id))
);
commit;
