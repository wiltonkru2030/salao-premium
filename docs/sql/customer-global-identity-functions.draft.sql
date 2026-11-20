-- SALÃO PREMIUM — associação controlada de cadastro legado à identidade global.
-- RASCUNHO DE REVISÃO; NÃO É MIGRATION E NÃO DEVE SER EXECUTADO EM PRODUÇÃO.
--
-- Dependências:
--   docs/sql/customer-global-identity-schema.sql
--   private.has_org_role(uuid, text[]) já existente no banco.
--
-- Decisões:
--   * A identidade global é independente de organização.
--   * Não criar membership apenas por abrir um link público de salão.
--   * O membership de reserva deverá ser criado na mesma transação que cria
--     o HOLD/reserva, após validar sessão, organização, filial e disponibilidade.
--   * A associação de cadastro legado exige confirmação de owner/admin,
--     validação do tenant, idempotência e auditoria.
--   * Telefone coincidente não comprova titularidade.
--   * Nenhuma função concede acesso geral a dados operacionais.
--
-- Antes de virar migration:
--   1. validar em Supabase local/staging com duas organizações e duas contas;
--   2. testar conflitos e chamadas concorrentes;
--   3. revisar grants, auditoria e Security Advisors;
--   4. gerar migration oficial com supabase migration new;
--   5. obter aprovação antes de aplicar em qualquer banco hospedado.

begin;

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
  -- A identidade do operador sempre vem da sessão autenticada.
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception 'Autenticação necessária.'
      using errcode = '42501';
  end if;

  if p_org_id is null or p_customer_id is null or p_auth_user_id is null then
    raise exception 'Dados insuficientes para confirmar a associação.'
      using errcode = '22023';
  end if;

  -- Somente owner/admin ativo da mesma organização pode confirmar o vínculo.
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

  -- Confirma que o cadastro operacional pertence à organização informada.
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

  -- Confirma que a identidade de destino existe no Supabase Auth.
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

  -- A mesma identidade não pode ser transferida para outro cadastro
  -- sem um processo separado de revisão e auditoria.
  select mapping.customer_id
    into v_existing_customer_id
    from public.customer_account_customers as mapping
   where mapping.org_id = p_org_id
     and mapping.auth_user_id = p_auth_user_id;

  if found then
    if v_existing_customer_id = p_customer_id then
      return p_customer_id; -- Repetição segura da mesma associação.
    end if;

    raise exception 'Esta conta já está associada a outro cadastro deste salão.'
      using errcode = '23505';
  end if;

  -- Um cadastro legado não pode pertencer a duas identidades globais.
  if exists (
    select 1
      from public.customer_account_customers as mapping
     where mapping.org_id = p_org_id
       and mapping.customer_id = p_customer_id
  ) then
    raise exception 'Este cadastro já está associado a outra conta.'
      using errcode = '23505';
  end if;

  -- O fluxo de confirmação assistida pode criar o membership legado.
  -- Nunca reativa silenciosamente uma associação suspensa.
  insert into public.customer_tenant_memberships as existing_membership (
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
           when existing_membership.status = 'pending' then 'active'
           else existing_membership.status
         end,
         source = case
           when existing_membership.status = 'pending' then 'legacy_link'
           else existing_membership.source
         end,
         joined_at = coalesce(existing_membership.joined_at, pg_catalog.now()),
         updated_at = pg_catalog.now()
  returning existing_membership.status
       into v_membership_status;

  if v_membership_status <> 'active' then
    raise exception 'O vínculo desta conta com o salão está suspenso.'
      using errcode = '42501';
  end if;

  -- As FKs compostas e as restrições UNIQUE do modelo impedem vínculo
  -- entre organizações e duplicidade de identidade/cadastro.
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

  -- A auditoria registra somente IDs e ação; não duplica dados pessoais.
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
  'Associa cadastro legado à identidade global somente por owner/admin do mesmo tenant, com idempotência e auditoria.';

-- Wrapper RPC público sem privilégio elevado. A validação privilegiada
-- permanece na função privada e usa auth.uid() + private.has_org_role().
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

comment on function public.link_customer_legacy(uuid, uuid, uuid) is
  'RPC autenticada para owner/admin confirmar e auditar a associação de um cadastro legado.';

-- Remover EXECUTE padrão de PUBLIC/anon; somente authenticated recebe acesso.
revoke all on function private.link_customer_legacy(uuid, uuid, uuid) from public, anon;
grant execute on function private.link_customer_legacy(uuid, uuid, uuid) to authenticated;

revoke all on function public.link_customer_legacy(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_customer_legacy(uuid, uuid, uuid) to authenticated;

commit;

-- Pendências antes da migration oficial:
-- 1. Revisar se o padrão de auditoria deve usar audit_logs ou audit_events.
-- 2. Testar duas chamadas concorrentes para o mesmo cadastro e identidade.
-- 3. Testar owner/admin autorizado, profissional, cliente e usuário de outro tenant.
-- 4. Implementar membership de reserva somente junto da transação do HOLD/reserva.
