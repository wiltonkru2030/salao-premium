-- SALÃO PREMIUM — identidade global da cliente
-- RASCUNHO NÃO EXECUTÁVEL EM PRODUÇÃO.
-- Antes de virar migration oficial: validar em ambiente local/staging, conferir grants,
-- testar com duas identidades/two tenants e revisar Security Advisors.
-- Não aplicar por execute_sql no banco de produção.

begin;

create table public.customer_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone_e164 text null check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz null,
  email text null,
  avatar_url text null check (avatar_url is null or avatar_url ~ '^https://'),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('pending','active','suspended','revoked')),
  source text not null
    check (source in ('customer_booking','staff_invite','legacy_link','admin_import')),
  joined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, auth_user_id)
);

create table public.customer_account_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  auth_user_id uuid not null,
  customer_id uuid not null,
  source text not null
    check (source in ('staff_confirmed','customer_claim_reviewed','admin_import')),
  linked_by uuid null references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  unique (org_id, customer_id),
  unique (org_id, auth_user_id, customer_id),
  foreign key (org_id, auth_user_id)
    references public.customer_tenant_memberships(org_id, auth_user_id) on delete cascade,
  foreign key (org_id, customer_id)
    references public.customers(org_id, id) on delete restrict
);

create index customer_tenant_memberships_user_status_idx
  on public.customer_tenant_memberships(auth_user_id, status);
create index customer_account_customers_user_org_idx
  on public.customer_account_customers(auth_user_id, org_id);

-- Trigger mantém updated_at do perfil sem permitir que o navegador escolha o valor.
create or replace function private.touch_customer_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

create trigger customer_profiles_touch_updated_at
before update on public.customer_profiles
for each row execute function private.touch_customer_profile_updated_at();

alter table public.customer_profiles enable row level security;
alter table public.customer_tenant_memberships enable row level security;
alter table public.customer_account_customers enable row level security;

create policy customer_profiles_select_self
  on public.customer_profiles for select to authenticated
  using ((select auth.uid()) = auth_user_id);
create policy customer_profiles_insert_self
  on public.customer_profiles for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);
create policy customer_profiles_update_self
  on public.customer_profiles for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

create policy customer_memberships_select_self
  on public.customer_tenant_memberships for select to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy customer_account_customers_select_self
  on public.customer_account_customers for select to authenticated
  using ((select auth.uid()) = auth_user_id);

-- O perfil global não permite que o usuário marque seu próprio telefone como verificado.
revoke all on public.customer_profiles from anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant insert (auth_user_id, full_name, phone_e164, email, avatar_url, preferences)
  on public.customer_profiles to authenticated;
grant update (full_name, phone_e164, email, avatar_url, preferences)
  on public.customer_profiles to authenticated;

-- Vínculos e associações são somente leitura para a cliente.
-- Criação/alteração exige backend privilegiado com auditoria e validação de tenant.
revoke all on public.customer_tenant_memberships from anon, authenticated;
grant select on public.customer_tenant_memberships to authenticated;
revoke all on public.customer_account_customers from anon, authenticated;
grant select on public.customer_account_customers to authenticated;

commit;

-- ATENÇÃO:
-- 1. Não há INSERT/UPDATE/DELETE direto para memberships ou associações legadas.
-- 2. O onboarding precisará de Edge Function/RPC controlada e auditada.
-- 3. Consultas de agendamentos, comandas, pacotes e créditos devem permanecer tenant-scoped.
-- 4. O acesso às tabelas operacionais não é concedido por estas políticas.
