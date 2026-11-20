-- SALÃO PREMIUM — confirmação da titularidade de cadastro legado
-- RASCUNHO PARA REVISÃO. NÃO EXECUTAR EM PRODUÇÃO.
--
-- Fluxo de duas etapas:
-- 1) Owner/admin cria solicitação para uma identidade Auth específica.
-- 2) A cliente entra autenticada naquela identidade e confirma explicitamente.
-- Só então a função privada cria membership + mapeamento na mesma transação.
--
-- Telefone coincidente, e-mail informado por funcionário ou clique do operador
-- NÃO substituem a confirmação autenticada da cliente.
--
-- Pré-requisitos:
-- - docs/sql/customer-global-identity-schema.sql revisado e aplicado em QA;
-- - private.has_org_role(uuid,text[]) existente;
-- - grants/schema private validados em ambiente local/staging.
--
-- Esta proposta adiciona uma tabela auxiliar de solicitações temporárias.
-- As três tabelas globais principais continuam com o modelo já documentado.

begin;

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
  on public.customer_identity_link_requests
    (org_id, customer_id, target_auth_user_id)
  where status = 'pending';

create index customer_identity_link_requests_target_idx
  on public.customer_identity_link_requests (target_auth_user_id, status, expires_at);

alter table public.customer_identity_link_requests enable row level security;
revoke all on public.customer_identity_link_requests from public, anon, authenticated;

-- Etapa 1: funcionário autorizado apenas solicita; não efetiva a associação.
create or replace function private.request_customer_legacy_link(
  p_org_id uuid,
  p_customer_id uuid,
  p_target_auth_user_id uuid
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

  insert into public.customer_identity_link_requests
    (org_id, customer_id, target_auth_user_id, requested_by)
  values (p_org_id, p_customer_id, p_target_auth_user_id, v_actor)
  on conflict (org_id, customer_id, target_auth_user_id)
    where status = 'pending'
  do update set expires_at = excluded.expires_at
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

-- Etapa 2: somente a identidade destinatária, autenticada, pode confirmar.
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
  where r.id = p_request_id
    and r.target_auth_user_id = v_actor
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
    update public.customer_identity_link_requests
       set status = 'expired'
     where id = p_request_id and status = 'pending';
    raise exception 'Esta solicitação expirou ou foi cancelada.' using errcode = '22023';
  end if;

  insert into public.customer_tenant_memberships
    (org_id, auth_user_id, status, source, joined_at)
  values (v_request.org_id, v_actor, 'active', 'legacy_link', pg_catalog.now())
  on conflict (org_id, auth_user_id) do nothing;

  if not exists (
    select 1 from public.customer_tenant_memberships m
    where m.org_id = v_request.org_id
      and m.auth_user_id = v_actor and m.status = 'active'
  ) then
    raise exception 'Seu vínculo com este salão está suspenso.' using errcode = '42501';
  end if;

  insert into public.customer_account_customers
    (org_id, auth_user_id, customer_id, link_source, linked_at, linked_by)
  values
    (v_request.org_id, v_actor, v_request.customer_id,
     'staff_confirmed', pg_catalog.now(), v_request.requested_by);

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

-- Wrappers invoker: privilégio elevado permanece no schema privado.
create or replace function public.request_customer_legacy_link(
  p_org_id uuid, p_customer_id uuid, p_target_auth_user_id uuid
) returns uuid
language sql security invoker set search_path = ''
as $function$
  select private.request_customer_legacy_link(p_org_id, p_customer_id, p_target_auth_user_id);
$function$;

create or replace function public.confirm_customer_legacy_link(p_request_id uuid)
returns uuid
language sql security invoker set search_path = ''
as $function$
  select private.confirm_customer_legacy_link(p_request_id);
$function$;

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

-- TESTES OBRIGATÓRIOS EM QA ANTES DE PROMOVER:
-- * owner/admin solicita; profissional/cliente/anônimo não solicita;
-- * somente target_auth_user_id confirma; outro usuário recebe 42501;
-- * solicitação expirada/cancelada não associa;
-- * confirmação cria membership e mapping uma única vez;
-- * duas solicitações concorrentes para identidade/cadastro diferentes:
--   constraints UNIQUE devem rejeitar a segunda sem associação cruzada;
-- * cliente não lê nem altera diretamente a tabela de solicitações;
-- * auditoria registra solicitante e confirmador sem copiar PII.
