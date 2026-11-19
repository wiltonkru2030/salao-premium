-- RASCUNHO DE MIGRATION — NÃO EXECUTAR DIRETAMENTE EM PRODUÇÃO.
-- O Supabase CLI não está disponível neste ambiente para gerar a migration oficial.
-- Antes de aplicar: criar migration com `supabase migration new cliente_identidade_marca`,
-- revisar este SQL, aplicar em ambiente de teste, validar RLS/advisors e testar com duas contas.
--
-- Objetivo:
--   1. Uma conta autenticada por cliente e por marca (org_id).
--   2. Preservar customers e appointments atuais sem mesclar ou apagar registros.
--   3. Permitir que vários registros operacionais de filiais apontem para a mesma conta.
--   4. Não usar telefone ou data de nascimento como prova de identidade.
--
-- Importante: os cadastros legados não são associados automaticamente. A ligação deve ser
-- confirmada por funcionário autorizado ou por fluxo futuro com telefone efetivamente verificado.

create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_accounts_birth_date_check
    check (birth_date is null or birth_date >= date '1900-01-01'),
  constraint customer_accounts_org_id_id_key unique (org_id, id),
  constraint customer_accounts_org_user_key unique (org_id, auth_user_id)
);

comment on table public.customer_accounts is
  'Identidade da cliente única dentro da marca/organização; não representa uma unidade física.';
comment on column public.customer_accounts.auth_user_id is
  'Identidade Supabase Auth confirmada; nunca preencher com user_id fornecido pelo navegador.';

create table if not exists public.customer_account_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  account_id uuid not null,
  customer_id uuid not null,
  linked_at timestamptz not null default now(),
  linked_by uuid references auth.users(id) on delete set null,
  constraint customer_account_customers_account_fk
    foreign key (org_id, account_id)
    references public.customer_accounts(org_id, id) on delete cascade,
  constraint customer_account_customers_customer_fk
    foreign key (org_id, customer_id)
    references public.customers(org_id, id) on delete cascade,
  constraint customer_account_customers_one_account_per_record
    unique (org_id, customer_id)
);

comment on table public.customer_account_customers is
  'Liga cadastros operacionais legados de diferentes filiais à identidade única da cliente na marca.';

create index if not exists customer_account_customers_account_idx
  on public.customer_account_customers(org_id, account_id);

alter table public.customer_accounts enable row level security;
alter table public.customer_account_customers enable row level security;

drop policy if exists customer_accounts_select_owner_or_staff on public.customer_accounts;
create policy customer_accounts_select_owner_or_staff
  on public.customer_accounts for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.has_org_role(org_id, array['owner','admin','manager','receptionist']::text[])
  );

drop policy if exists customer_account_customers_select_owner_or_staff on public.customer_account_customers;
create policy customer_account_customers_select_owner_or_staff
  on public.customer_account_customers for select to authenticated
  using (
    exists (
      select 1 from public.customer_accounts account
      where account.org_id = customer_account_customers.org_id
        and account.id = customer_account_customers.account_id
        and account.auth_user_id = (select auth.uid())
    )
    or private.has_org_role(org_id, array['owner','admin','manager','receptionist']::text[])
  );

drop policy if exists customer_account_customers_insert_staff on public.customer_account_customers;
create policy customer_account_customers_insert_staff
  on public.customer_account_customers for insert to authenticated
  with check (
    private.has_org_role(org_id, array['owner','admin','manager','receptionist']::text[])
    and exists (
      select 1 from public.customer_accounts account
      where account.org_id = customer_account_customers.org_id
        and account.id = customer_account_customers.account_id
    )
    and linked_by = (select auth.uid())
    and exists (
      select 1 from public.customers customer
      where customer.org_id = customer_account_customers.org_id
        and customer.id = customer_account_customers.customer_id
    )
  );

-- Criação idempotente da conta. A função privada nunca aceita auth_user_id como parâmetro:
-- a identidade vem exclusivamente de auth.uid() validado no token Supabase.
create or replace function private.register_customer_account(
  p_org_slug text,
  p_full_name text,
  p_birth_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_account_id uuid;
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.' using errcode = '28000';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Nome inválido.' using errcode = '22023';
  end if;

  if p_birth_date is not null
     and (p_birth_date < date '1900-01-01' or p_birth_date > current_date) then
    raise exception 'Data de nascimento inválida.' using errcode = '22023';
  end if;

  select org.id into v_org_id
  from public.organizations org
  where org.slug = lower(btrim(coalesce(p_org_slug, '')))
  limit 1;

  if v_org_id is null then
    raise exception 'Marca não encontrada.' using errcode = 'P0002';
  end if;

  select account.id into v_account_id
  from public.customer_accounts account
  where account.org_id = v_org_id and account.auth_user_id = v_user_id;

  if v_account_id is not null then
    return v_account_id;
  end if;

  insert into public.customer_accounts (org_id, auth_user_id, full_name, birth_date)
  values (v_org_id, v_user_id, v_name, p_birth_date)
  on conflict (org_id, auth_user_id) do nothing
  returning id into v_account_id;

  if v_account_id is null then
    select account.id into v_account_id
    from public.customer_accounts account
    where account.org_id = v_org_id and account.auth_user_id = v_user_id;
  end if;

  return v_account_id;
end;
$function$;

revoke all on function private.register_customer_account(text, text, date) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.register_customer_account(text, text, date) to authenticated;

-- RPC pública como invoker: a função privilegiada permanece no schema privado.
create or replace function public.register_customer_account(
  p_org_slug text,
  p_full_name text,
  p_birth_date date default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.register_customer_account(p_org_slug, p_full_name, p_birth_date);
$function$;

revoke all on function public.register_customer_account(text, text, date) from public, anon;
grant execute on function public.register_customer_account(text, text, date) to authenticated;

-- O Data API exige GRANT explícito; RLS continua responsável pelo isolamento de linhas.
grant select on public.customer_accounts to authenticated;
grant select, insert on public.customer_account_customers to authenticated;

-- Não conceder INSERT/UPDATE direto em customer_accounts: a RPC cria a conta a partir de auth.uid().
-- Não conceder UPDATE/DELETE em customer_account_customers: desfazer vínculo exige fluxo auditado.
-- Esta etapa NÃO concede leitura de appointments nem histórico financeiro ao app cliente.
