
create or replace function private.get_professional_cpf_login_pepper()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name='professional_cpf_login_pepper'
  limit 1;
$$;
revoke all on function private.get_professional_cpf_login_pepper() from public, anon, authenticated;
grant execute on function private.get_professional_cpf_login_pepper() to service_role;

create or replace function public.get_professional_cpf_login_pepper()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_professional_cpf_login_pepper();
$$;
revoke all on function public.get_professional_cpf_login_pepper() from public, anon, authenticated;
grant execute on function public.get_professional_cpf_login_pepper() to service_role;
