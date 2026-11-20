-- SALÃO PREMIUM — identidade global da cliente (migration oficial versionada).
-- Criada em 20/11/2026 e aplicada após autorização explícita do proprietário.
-- Cria perfil global, memberships por organização, mapeamento legado com FK
-- composta e fluxo de associação em duas etapas com confirmação da cliente.
-- A cliente não pode inserir memberships/mapeamentos nem alterar telefone verificado.
-- Todos os dados operacionais permanecem isolados por org_id.

begin;

create table public.customer_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_e164 text,
  phone_verified_at timestamptz,
  email text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_full_name_length
    check (char_length(btrim(full_name)) between 2 and 120),
  constraint customer_profiles_phone_e164_format
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint customer_profiles_email_length
    check (email is null or char_length(email) <= 254),
  constraint customer_profiles_avatar_https
    check (avatar_url is null or avatar_url ~ '^https://'),
  constraint customer_profiles_preferences_object
    check (jsonb_typeof(preferences) = 'object')
);

comment on table public.customer_profiles is
  'Perfil global único por usuário Auth; não armazena histórico operacional de salões.';
comment on column public.customer_profiles.phone_verified_at is
  'Preenchido somente por fluxo confiável que comprove posse do telefone. Nunca aceitar do cliente.';
comment on column public.customer_profiles.preferences is
  'Preferências globais não operacionais; preferências específicas de salão ficam no tenant.';

create table public.customer_tenant_memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  source text not null default 'booking_link',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, auth_user_id),
  constraint customer_tenant_memberships_status
    check (status in ('pending', 'active', 'suspended')),
  constraint customer_tenant_memberships_source
    check (source in ('booking_link', 'staff_invite', 'legacy_link', 'platform'))
);

comment on table public.customer_tenant_memberships is
  'Vínculo de acesso da identidade global com uma organização; não concede acesso a outras organizações.';

create index customer_tenant_memberships_user_status_idx
  on public.customer_tenant_memberships (auth_user_id, status);

create table public.customer_account_customers (
  org_id uuid not null,
  auth_user_id uuid not null,
  customer_id uuid not null,
  link_source text not null default 'staff_confirmed',
  linked_at timestamptz not null default now(),
  linked_by uuid references auth.users(id) on delete set null,
  primary key (org_id, auth_user_id),
  constraint customer_account_customers_membership_fk
    foreign key (org_id, auth_user_id)
    references public.customer_tenant_memberships(org_id, auth_user_id)
    on delete cascade,
  constraint customer_account_customers_legacy_customer_fk
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete cascade,
  constraint customer_account_customers_link_source
    check (link_source in ('staff_confirmed', 'strong_identity_match', 'customer_created')),
  constraint customer_account_customers_one_identity_per_legacy_customer
    unique (org_id, customer_id)
);

comment on table public.customer_account_customers is
  'Mapeia identidade global para cadastro operacional legado dentro do mesmo org_id. Associação não é autoexecutada por telefone.';

create index customer_account_customers_customer_idx
  on public.customer_account_customers (org_id, customer_id);
create index customer_account_customers_auth_user_idx
  on public.customer_account_customers (auth_user_id, org_id);

alter table public.customer_profiles enable row level security;
alter table public.customer_tenant_memberships enable row level security;
alter table public.customer_account_customers enable row level security;

create policy customer_profiles_select_self
  on public.customer_profiles for select to authenticated
  using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));
create policy customer_profiles_insert_self
  on public.customer_profiles for insert to authenticated
  with check ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));
create policy customer_profiles_update_self
  on public.customer_profiles for update to authenticated
  using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));
create policy customer_tenant_memberships_select_self
  on public.customer_tenant_memberships for select to authenticated
  using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));
create policy customer_account_customers_select_self_active_membership
  on public.customer_account_customers for select to authenticated
  using (
    (select auth.uid()) is not null
    and auth_user_id = (select auth.uid())
    and exists (
      select 1
      from public.customer_tenant_memberships m
      where m.org_id = customer_account_customers.org_id
        and m.auth_user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

revoke all on public.customer_profiles from public, anon, authenticated;
revoke all on public.customer_tenant_memberships from public, anon, authenticated;
revoke all on public.customer_account_customers from public, anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant insert (auth_user_id, full_name, phone_e164, email, avatar_url, preferences)
  on public.customer_profiles to authenticated;
grant update (full_name, phone_e164, email, avatar_url, preferences)
  on public.customer_profiles to authenticated;
grant select on public.customer_tenant_memberships to authenticated;
grant select on public.customer_account_customers to authenticated;

create table public.customer_identity_link_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  target_auth_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  confirmed_at timestamptz,
  constraint customer_identity_link_requests_customer_fk
    foreign key (org_id, customer_id)
    references public.customers(org_id, id) on delete cascade,
  constraint customer_identity_link_requests_status
    check (status in ('pending', 'confirmed', 'expired', 'cancelled')),
  constraint customer_identity_link_requests_expiry
    check (expires_at > created_at),
  constraint customer_identity_link_requests_confirmation
    check ((status = 'confirmed') = (confirmed_at is not null))
);

create unique index customer_identity_link_requests_one_pending_idx
  on public.customer_identity_link_requests (org_id, customer_id, target_auth_user_id)
  where status = 'pending';
create index customer_identity_link_requests_target_idx
  on public.customer_identity_link_requests (target_auth_user_id, status, expires_at);

alter table public.customer_identity_link_requests enable row level security;
revoke all on public.customer_identity_link_requests from public, anon, authenticated;

create or replace function private.request_customer_legacy_link(
  p_org_id uuid, p_customer_id uuid, p_target_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_request_id uuid;
begin
  if v_actor is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if p_org_id is null or p_customer_id is null or p_target_auth_user_id is null then
    raise exception 'Informe salão, cadastro e conta da cliente.' using errcode = '22023';
  end if;
  if not private.has_org_role(p_org_id, array['owner','admin']::text[]) then
    raise exception 'Somente owner ou administrador pode solicitar a associação.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.org_id = p_org_id and c.id = p_customer_id
  ) then
    raise exception 'Cadastro não encontrado neste salão.' using errcode = '23503';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_target_auth_user_id) then
    raise exception 'Conta da cliente não encontrada.' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.customer_account_customers m
    where m.org_id = p_org_id and m.customer_id = p_customer_id
  ) then
    raise exception 'Este cadastro já está associado a uma conta.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.customer_account_customers m
    where m.org_id = p_org_id and m.auth_user_id = p_target_auth_user_id
  ) then
    raise exception 'Esta conta já possui um cadastro neste salão.' using errcode = '23505';
  end if;

  insert into public.customer_identity_link_requests
    (org_id, customer_id, target_auth_user_id, requested_by)
  values (p_org_id, p_customer_id, p_target_auth_user_id, v_actor)
  on conflict (org_id, customer_id, target_auth_user_id)
    where status = 'pending'
  do update set expires_at = excluded.expires_at,
                requested_by = excluded.requested_by
  returning id into v_request_id;

  insert into public.audit_logs
    (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_org_id, v_actor, 'customer_identity_link_requested',
    'customer_identity_link_requests', v_request_id,
    pg_catalog.jsonb_build_object('customer_id', p_customer_id,
      'target_auth_user_id', p_target_auth_user_id, 'expires_in_hours', 48)
  );
  return v_request_id;
end;
$function$;

create or replace function private.get_my_pending_customer_link_requests()
returns table (
  request_id uuid, org_id uuid, salon_name text, customer_name text,
  phone_suffix text, expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select r.id, r.org_id, o.name, c.name,
    nullif(pg_catalog.right(
      pg_catalog.regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 2
    ), ''),
    r.expires_at
  from public.customer_identity_link_requests r
  join public.organizations o on o.id = r.org_id
  join public.customers c on c.org_id = r.org_id and c.id = r.customer_id
  where r.target_auth_user_id = (select auth.uid())
    and r.status = 'pending'
    and r.expires_at > pg_catalog.now()
  order by r.created_at desc;
$function$;

create or replace function private.confirm_customer_legacy_link(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_request public.customer_identity_link_requests%rowtype;
  v_existing uuid;
begin
  if v_actor is null then
    raise exception 'Entre na sua conta para confirmar.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Solicitação inválida.' using errcode = '22023';
  end if;

  select * into v_request
  from public.customer_identity_link_requests r
  where r.id = p_request_id and r.target_auth_user_id = v_actor
  for update;

  if not found then
    raise exception 'Solicitação não encontrada para esta conta.' using errcode = '42501';
  end if;
  if v_request.status = 'confirmed' then
    select m.customer_id into v_existing
    from public.customer_account_customers m
    where m.org_id = v_request.org_id and m.auth_user_id = v_actor;
    if v_existing = v_request.customer_id then return v_existing; end if;
    raise exception 'Solicitação já utilizada.' using errcode = '23505';
  end if;
  if v_request.status <> 'pending' or v_request.expires_at <= pg_catalog.now() then
    raise exception 'Esta solicitação expirou ou foi cancelada.' using errcode = '22023';
  end if;

  insert into public.customer_tenant_memberships
    (org_id, auth_user_id, status, source, joined_at)
  values (v_request.org_id, v_actor, 'active', 'legacy_link', pg_catalog.now())
  on conflict (org_id, auth_user_id) do nothing;

  if not exists (
    select 1 from public.customer_tenant_memberships m
    where m.org_id = v_request.org_id and m.auth_user_id = v_actor and m.status = 'active'
  ) then
    raise exception 'Seu vínculo com este salão está suspenso.' using errcode = '42501';
  end if;

  begin
    insert into public.customer_account_customers
      (org_id, auth_user_id, customer_id, link_source, linked_at, linked_by)
    values (v_request.org_id, v_actor, v_request.customer_id,
      'staff_confirmed', pg_catalog.now(), v_request.requested_by);
  exception when unique_violation then
    raise exception 'Este cadastro ou esta conta já está associado a outro vínculo neste salão.'
      using errcode = '23505';
  end;

  update public.customer_identity_link_requests
     set status = 'confirmed', confirmed_at = pg_catalog.now()
   where id = p_request_id;

  insert into public.audit_logs
    (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_request.org_id, v_actor, 'customer_identity_link_confirmed',
    'customer_account_customers', v_request.customer_id,
    pg_catalog.jsonb_build_object('request_id', p_request_id,
      'requested_by', v_request.requested_by, 'confirmed_by', v_actor)
  );
  return v_request.customer_id;
end;
$function$;

create or replace function public.request_customer_legacy_link(
  p_org_id uuid, p_customer_id uuid, p_target_auth_user_id uuid
) returns uuid
language sql security invoker set search_path = ''
as $function$
  select private.request_customer_legacy_link(p_org_id, p_customer_id, p_target_auth_user_id);
$function$;

create or replace function public.get_my_pending_customer_link_requests()
returns table (
  request_id uuid, org_id uuid, salon_name text, customer_name text,
  phone_suffix text, expires_at timestamptz
)
language sql security invoker set search_path = ''
as $function$
  select * from private.get_my_pending_customer_link_requests();
$function$;

create or replace function public.confirm_customer_legacy_link(p_request_id uuid)
returns uuid
language sql security invoker set search_path = ''
as $function$
  select private.confirm_customer_legacy_link(p_request_id);
$function$;

revoke all on function private.get_my_pending_customer_link_requests() from public, anon;
grant execute on function private.get_my_pending_customer_link_requests() to authenticated;
revoke all on function public.get_my_pending_customer_link_requests() from public, anon, authenticated;
grant execute on function public.get_my_pending_customer_link_requests() to authenticated;
revoke all on function private.request_customer_legacy_link(uuid,uuid,uuid) from public, anon;
revoke all on function private.confirm_customer_legacy_link(uuid) from public, anon;
grant execute on function private.request_customer_legacy_link(uuid,uuid,uuid) to authenticated;
grant execute on function private.confirm_customer_legacy_link(uuid) to authenticated;
revoke all on function public.request_customer_legacy_link(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.confirm_customer_legacy_link(uuid) from public, anon, authenticated;
grant execute on function public.request_customer_legacy_link(uuid,uuid,uuid) to authenticated;
grant execute on function public.confirm_customer_legacy_link(uuid) to authenticated;

comment on table public.customer_identity_link_requests is
  'Solicitações temporárias de associação legado; a cliente destinatária precisa confirmar autenticada.';

commit;