
create policy professional_login_identities_service_role_only
on private.professional_login_identities
for all to service_role
using (true) with check (true);

create or replace function public.resolve_professional_login(p_cpf_hmac bytea)
returns table(auth_user_id uuid, org_id uuid, professional_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select i.auth_user_id, i.org_id, i.professional_id
  from private.professional_login_identities i
  join public.professionals p
    on p.org_id=i.org_id and p.id=i.professional_id
  join public.org_memberships m
    on m.org_id=i.org_id and m.user_id=i.auth_user_id
   and m.role='professional' and m.status='active'
  where i.cpf_hmac=p_cpf_hmac and i.enabled=true
    and p.active=true and p.access_enabled=true
  limit 1;
$$;
revoke all on function public.resolve_professional_login(bytea) from public, anon, authenticated;
grant execute on function public.resolve_professional_login(bytea) to service_role;

create table if not exists private.professional_login_attempts (
  attempt_key bytea primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1,
  blocked_until timestamptz
);
alter table private.professional_login_attempts enable row level security;
create policy professional_login_attempts_service_role_only
on private.professional_login_attempts for all to service_role
using (true) with check (true);
revoke all on private.professional_login_attempts from public, anon, authenticated;

create or replace function public.consume_professional_login_attempt(p_attempt_key bytea)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare current_row private.professional_login_attempts%rowtype;
begin
  insert into private.professional_login_attempts(attempt_key)
  values (p_attempt_key)
  on conflict (attempt_key) do nothing;

  select * into current_row
  from private.professional_login_attempts
  where attempt_key=p_attempt_key
  for update;

  if current_row.blocked_until is not null and current_row.blocked_until > now() then
    return false;
  end if;

  if current_row.window_started_at < now() - interval '15 minutes' then
    update private.professional_login_attempts
       set window_started_at=now(), attempts=1, blocked_until=null
     where attempt_key=p_attempt_key;
    return true;
  end if;

  if current_row.attempts >= 10 then
    update private.professional_login_attempts
       set blocked_until=now() + interval '15 minutes'
     where attempt_key=p_attempt_key;
    return false;
  end if;

  update private.professional_login_attempts
     set attempts=attempts+1
   where attempt_key=p_attempt_key;
  return true;
end;
$$;
revoke all on function public.consume_professional_login_attempt(bytea) from public, anon, authenticated;
grant execute on function public.consume_professional_login_attempt(bytea) to service_role;
