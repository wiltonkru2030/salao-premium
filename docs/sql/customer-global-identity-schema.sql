-- SALÃO PREMIUM — identidade global da cliente
-- ESPECIFICAÇÃO SQL PARA REVISÃO; NÃO É MIGRATION APLICÁVEL.
-- Não executar no projeto hospedado. Gerar migration oficial com Supabase CLI
-- após revisão, testes em ambiente local/staging e aprovação explícita.
--
-- Modelo:
--   customer_profiles: uma identidade por auth.users.id em toda a plataforma.
--   customer_tenant_memberships: vínculo dessa identidade com uma organização.
--   customer_account_customers: associação controlada ao cadastro operacional legado.
--
-- Segurança:
--   * Dados operacionais continuam em customers/appointments/etc. por org_id.
--   * Cliente só lê seu próprio perfil, vínculos e associações.
--   * Cliente não cria vínculos nem associa cadastros legados diretamente.
--   * Telefone não é prova de identidade; phone_verified_at só é alterado
--     por fluxo confiável de verificação, nunca pelo cliente.
--   * Associação de cadastro legado deve ocorrer por RPC privada/backend
--     com autenticação forte, validação de organização e auditoria.
--
-- Pré-condições já verificadas no projeto:
--   public.organizations(id uuid)
--   public.customers(id uuid, org_id uuid)
--   UNIQUE public.customers(org_id, id)
--   public.customers tem FK para organizations e branches.
--   private.has_org_role(uuid, text[]) e private.is_org_member(uuid) existem.
--
-- ATENÇÃO: este arquivo é uma proposta de DDL e precisa ser transformado em
-- migration pelo fluxo oficial do Supabase CLI depois da revisão do schema.

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

-- RLS: as três tabelas ficam protegidas mesmo se forem expostas pela Data API.
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

-- Privilégio mínimo: cliente não pode definir auth_user_id nem phone_verified_at
-- em UPDATE, nem criar membership/associação diretamente.
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

-- Não conceder INSERT/UPDATE/DELETE em memberships e account_customers ao cliente.
-- Operações privilegiadas futuras devem usar funções no schema private, com:
-- auth.uid() obrigatório, search_path fixo, validação de org/role/membership,
-- EXECUTE revogado de PUBLIC/anon e concessão apenas ao papel necessário.
-- Não criar SECURITY DEFINER em public.

commit;
