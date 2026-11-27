-- Pré-verificação somente leitura: não retorna CPF, e-mail, IDs ou metadados individuais.
-- Executar no projeto QA e no projeto de produção antes de liberar a autenticação.
select count(distinct u.id) as professional_accounts,
 count(distinct u.id) filter(where u.raw_app_meta_data->>'professional_password_required'='true') as trusted_required,
 count(distinct u.id) filter(where u.raw_user_meta_data->>'must_change_password'='true'
   and coalesce(u.raw_app_meta_data->>'professional_password_generation','')='') as legacy_required,
 count(distinct u.id) filter(where u.raw_app_meta_data->>'professional_password_generation' is not null) as generation_present,
 count(distinct u.id) filter(where exists(select 1 from public.org_memberships x where x.user_id=u.id and x.role<>'professional')) as mixed_roles
from auth.users u join public.org_memberships m on m.user_id=u.id and m.role='professional'
join public.professionals p on p.org_id=m.org_id and p.profile_id=u.id;
