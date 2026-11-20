-- RASCUNHO — histórico de agendamentos da identidade global da cliente.
-- Não aplicar em produção sem revisão e autorização explícita.
-- Retorna somente agendamentos associados à própria identidade Auth.
-- Inclui registros legados somente depois da associação confirmada pela cliente.

begin;

grant usage on schema private to authenticated;

create or replace function private.get_my_customer_appointments()
returns table (
  appointment_id uuid,
  salon_name text,
  branch_name text,
  service_name text,
  professional_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  price numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    a.id,
    o.name,
    b.name,
    coalesce(nullif(a.service_name, ''), s.name),
    coalesce(nullif(a.professional_name, ''), p.name),
    a.starts_at,
    a.ends_at,
    a.status,
    a.price,
    a.created_at
  from public.appointments a
  join public.customer_account_customers link
    on link.org_id = a.org_id
   and link.customer_id = a.customer_id
   and link.auth_user_id = (select auth.uid())
  join public.customer_tenant_memberships membership
    on membership.org_id = link.org_id
   and membership.auth_user_id = link.auth_user_id
   and membership.status = 'active'
  join public.organizations o on o.id = a.org_id
  left join public.branches b on b.org_id = a.org_id and b.id = a.branch_id
  left join public.services s on s.org_id = a.org_id and s.id = a.service_id
  left join public.professionals p on p.org_id = a.org_id and p.id = a.professional_id
  where (select auth.uid()) is not null
  order by a.starts_at desc, a.id desc;
$function$;

revoke all on function private.get_my_customer_appointments() from public, anon, authenticated;
grant execute on function private.get_my_customer_appointments() to authenticated;

create or replace function public.get_my_customer_appointments()
returns table (
  appointment_id uuid,
  salon_name text,
  branch_name text,
  service_name text,
  professional_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  price numeric,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_my_customer_appointments();
$function$;

revoke all on function public.get_my_customer_appointments() from public, anon, authenticated;
grant execute on function public.get_my_customer_appointments() to authenticated;

comment on function public.get_my_customer_appointments() is
  'Lista somente agendamentos ligados à identidade Auth atual e a membership ativa; não recebe IDs de cliente pelo navegador.';

commit;
