
create or replace function public.register_professional_login(
  p_org_id uuid,
  p_professional_id uuid,
  p_auth_user_id uuid,
  p_cpf_hmac bytea,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.professional_login_identities(
    org_id, professional_id, auth_user_id, cpf_hmac, enabled, updated_at
  ) values (
    p_org_id, p_professional_id, p_auth_user_id, p_cpf_hmac, p_enabled, now()
  )
  on conflict (org_id, professional_id)
  do update set
    auth_user_id=excluded.auth_user_id,
    cpf_hmac=excluded.cpf_hmac,
    enabled=excluded.enabled,
    updated_at=now();
end;
$$;
revoke all on function public.register_professional_login(uuid,uuid,uuid,bytea,boolean) from public, anon, authenticated;
grant execute on function public.register_professional_login(uuid,uuid,uuid,bytea,boolean) to service_role;
