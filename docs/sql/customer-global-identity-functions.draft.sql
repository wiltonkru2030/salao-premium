-- SALÃO PREMIUM — funções controladas da identidade global da cliente
-- RASCUNHO DE REVISÃO; NÃO É MIGRATION E NÃO DEVE SER EXECUTADO EM PRODUÇÃO.
--
-- Dependências:
--   docs/sql/customer-global-identity-schema.sql
--   private.has_org_role(uuid, text[]) já existente no banco.
--
-- Decisões aplicadas:
--   1. Abrir um link público de salão pode criar/ativar somente o membership
--      da identidade autenticada para a organização identificada pelo slug.
--   2. Membership suspenso nunca é reativado por abrir um link.
--   3. Associação de cadastro legado exige owner/admin autenticado, validação
--      do tenant e do customer_id, é idempotente e gera auditoria.
--   4. Nenhuma função concede acesso às tabelas operacionais do salão.
--   5. Funções públicas são SECURITY INVOKER; a lógica privilegiada fica
--      exclusivamente no schema privado, com search_path vazio.
--
-- Antes de virar migration:
--   * validar em Supabase local/staging com duas organizações e duas contas;
--   * testar concorrência e conflitos de associação;
--   * conferir grants e Security Advisors;
--   * gerar o arquivo oficial com supabase migration new;
--   * obter aprovação antes de aplicar em qualquer banco hospedado.

begin;

-- ---------------------------------------------------------------------------
-- 1. Entrar em um salão pelo slug do link público.
-- ---------------------------------------------------------------------------
create or replace function private.join_customer_tenant(
  p_org_slug text
)
returns table (
  org_id uuid,
  membership_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_user_id uuid;
  v_org_id uuid;
  v_status text;
begin
  -- A identidade sempre vem da sessão; nunca confiar em ID enviado pelo app.
  v_auth_user_id := (select auth.uid());

  if v_auth_user_id is null then
    raise exception 'Autenticação necessária.'
      using errcode = '42501';
  end if;

  if p_org_slug is null or pg_catalog.length(pg_catalog.btrim(p_org_slug)) < 2 then
    raise exception 'Link do salão inválido.'
      using errcode = '22023';
  end if;

  -- O slug identifica a organização, mas não é usado como prova de permissão.
  select o.id
    into v_org_id
    from public.organizations as o
   where o.slug = pg_catalog.lower(pg_catalog.btrim(p_org_slug));

  if v_org_id is null then
    raise exception 'Salão não encontrado.'
      using errcode = 'P0002';
  end if;

  -- Operação idempotente: repetir a abertura do mesmo link não duplica vínculo.
  -- Somente memberships pendentes podem ser ativados por esse fluxo.
  insert into public.customer_tenant_memberships (
    org_id,
    auth_user_id,
    status,
    source,
    joined_at
  )
  values (
    v_org_id,
    v_auth_user_id,
    'active',
    'booking_link',
    pg_catalog.now()
  )
  on conflict (org_id, auth_user_id)
  do update
     set status = case
           when public.customer_tenant_memberships.status = 'pending'
             then 'active'
           else public.customer_tenant_memberships.status
         end,
         source = case
           when public.customer_tenant_memberships.status = 'pending'
             then 'booking_link'
           else public.customer_tenant_memberships.source
         end,
         joined_at = coalesce(
           public.customer_tenant_memberships.joined_at,
           pg_catalog.now()
         ),
         updated_at = pg_catalog.now()
  returning public.customer_tenant_memberships.status
       into v_status;

  -- Um membership suspenso não é reativado silenciosamente pelo link público.
  if v_status <> 'active' then
    raise exception 'O acesso a este salão está suspenso. Entre em contato com a equipe.'
      using errcode = '42501';
  end if;

  return query select v_org_id, v_status;
end;
$function$;

comment on function private.join_customer_tenant(text) is
  'Cria ou ativa idempotentemente o vínculo da identidade autenticada com o salão identificado pelo slug. Não concede acesso operacional.';

-- ---------------------------------------------------------------------------
-- 2. Associar cadastro operacional antigo a uma identidade global.
-- ---------------------------------------------------------------------------
create or replace function private.link_customer_legacy(
  p_org_id uuid,
  p_customer_id uuid,
  p_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_customer_exists boolean;
  v_target_user_exists boolean;
  v_membership_status text;
  v_existing_customer_id uuid;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception 'Autenticação necessária.'
      using errcode = '42501';
  end if;

  if p_org_id is null or p_customer_id is null or p_auth_user_id is null then
    raise exception 'Dados insuficientes para confirmar a associação.'
      using errcode = '22023';
  end if;

  -- Somente owner/admin do mesmo tenant pode confirmar um cadastro legado.
  if not private.has_org_role(p_org_id, array['owner', 'admin']::text[]) then
    raise exception 'Você não tem permissão para associar clientes neste salão.'
      using errcode = '42501';
  end if;

  select m.role
    into v_actor_role
    from public.org_memberships as m
   where m.org_id = p_org_id
     and m.user_id = v_actor_id
     and m.status = 'active';

  select exists (
    select 1
      from public.customers as c
     where c.org_id = p_org_id
       and c.id = p_customer_id
  )
  into v_customer_exists;

  if not v_customer_exists then
    raise exception 'Cadastro de cliente não encontrado neste salão.'
      using errcode = '23503';
  end if;

  select exists (
    select 1
      from auth.users as u
     where u.id = p_auth_user_id
  )
  into v_target_user_exists;

  if not v_target_user_exists then
    raise exception 'Conta da cliente não encontrada.'
      using errcode = '23503';
  end if;

  -- Uma identidade não pode ser transferida silenciosamente para outro cadastro.
  select m.customer_id
    into v_existing_customer_id
    from public.customer_account_customers as m
   where m.org_id = p_org_id
     and m.auth_user_id = p_auth_user_id;

  if found then
    if v_existing_customer_id = p_customer_id then
      return p_customer_id; -- Repetição segura: já está associada corretamente.
    end if;

    raise exception 'Esta conta já está associada a outro cadastro deste salão.'
      using errcode = '23505';
  end if;

  -- Um cadastro legado também não pode pertencer a duas identidades globais.
  if exists (
    select 1
      from public.customer_account_customers as m
     where m.org_id = p_org_id
       and m.customer_id = p_customer_id
  ) then
    raise exception 'Este cadastro já está associado a outra conta.'
      using errcode = '23505';
  end if;

  -- Cria/ativa o membership no mesmo tenant. Nunca reativa vínculo suspenso.
  insert into public.customer_tenant_memberships (
    org_id,
    auth_user_id,
    status,
    source,
    joined_at
  )
  values (
    p_org_id,
    p_auth_user_id,
    'active',
    'legacy_link',
    pg_catalog.now()
  )
  on conflict (org_id, auth_user_id)
  do update
     set status = case
           when public.customer_tenant_memberships.status = 'pending'
             then 'active'
           else public.customer_tenant_memberships.status
         end,
         source = case
           when public.customer_tenant_memberships.status = 'pending'
             then 'legacy_link'
           else public.customer_tenant_memberships.source
         end,
         joined_at = coalesce(
           public.customer_tenant_memberships.joined_at,
           pg_catalog.now()
         ),
         updated_at = pg_catalog.now()
  returning public.customer_tenant_memberships.status
       into v_membership_status;

  if v_membership_status <> 'active' then
    raise exception 'O vínculo desta conta com o salão está suspenso.'
      using errcode = '42501';
  end if;

  -- As FKs compostas garantem que identidade, organização e cadastro pertençam
  -- ao mesmo tenant. A restrição UNIQUE também impede associação duplicada.
  insert into public.customer_account_customers (
    org_id,
    auth_user_id,
    customer_id,
    link_source,
    linked_at,
    linked_by
  )
  values (
    p_org_id,
    p_auth_user_id,
    p_customer_id,
    'staff_confirmed',
    pg_catalog.now(),
    v_actor_id
  );

  -- Auditoria mínima: IDs e ação, sem telefone, e-mail ou outros dados pessoais.
  insert into public.audit_logs (
    org_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_org_id,
    v_actor_id,
    'customer_identity_linked',
    'customer_account_customers',
    null,
    pg_catalog.jsonb_build_object(
      'customer_id', p_customer_id,
      'auth_user_id', p_auth_user_id,
      'source', 'staff_confirmed',
      'actor_role', v_actor_role
    )
  );

  return p_customer_id;
end;
$function$;

comment on function private.link_customer_legacy(uuid, uuid, uuid) is
  'Associa cadastro operacional legado a identidade global somente por owner/admin do mesmo tenant, com idempotência e auditoria.';

-- ---------------------------------------------------------------------------
-- 3. Superfície RPC pública mínima.
--    Os wrappers são SECURITY INVOKER e não contêm lógica privilegiada.
-- ---------------------------------------------------------------------------
create or replace function public.join_customer_tenant(
  p_org_slug text
)
returns table (
  org_id uuid,
  membership_status text
)
language sql
security invoker
set search_path = ''
as $function$
  select *
    from private.join_customer_tenant(p_org_slug);
$function$;

create or replace function public.link_customer_legacy(
  p_org_id uuid,
  p_customer_id uuid,
  p_auth_user_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.link_customer_legacy(
    p_org_id,
    p_customer_id,
    p_auth_user_id
  );
$function$;

comment on function public.join_customer_tenant(text) is
  'RPC autenticada para registrar o vínculo da cliente com um salão aberto por link público.';
comment on function public.link_customer_legacy(uuid, uuid, uuid) is
  'RPC autenticada para owner/admin confirmar e auditar a associação de um cadastro legado.';

-- Remover EXECUTE padrão de PUBLIC e anon. Somente authenticated recebe acesso.
revoke all on function private.join_customer_tenant(text) from public, anon;
revoke all on function private.link_customer_legacy(uuid, uuid, uuid) from public, anon;
grant execute on function private.join_customer_tenant(text) to authenticated;
grant execute on function private.link_customer_legacy(uuid, uuid, uuid) to authenticated;

revoke all on function public.join_customer_tenant(text) from public, anon, authenticated;
revoke all on function public.link_customer_legacy(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_customer_tenant(text) to authenticated;
grant execute on function public.link_customer_legacy(uuid, uuid, uuid) to authenticated;

commit;

-- Revisões pendentes antes de migration oficial:
-- 1. Confirmar se a política de ativação por link público está aprovada.
-- 2. Validar se o evento audit_logs corresponde ao padrão de auditoria do produto.
-- 3. Testar duas chamadas concorrentes para a mesma identidade/cadastro.
-- 4. Testar usuário autenticado sem membership, funcionário de outro tenant e anon.
