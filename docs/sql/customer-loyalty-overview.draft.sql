-- Visão privada de relacionamento/fidelidade: dados reais, sem pontos nem descontos fictícios.
-- Não altera a contabilidade; cada cliente vê apenas seus próprios vínculos ativos.
begin;
create or replace function private.get_my_customer_loyalty_overview()
returns table(org_id uuid,salon_name text,completed_appointments bigint,paid_orders bigint,
 total_paid numeric,last_paid_at timestamptz)
language sql stable security definer set search_path='' as $fn$
 with owned as (
   select distinct link.org_id,link.customer_id
   from public.customer_account_customers link
   join public.customer_tenant_memberships membership
     on membership.org_id=link.org_id and membership.auth_user_id=link.auth_user_id
     and membership.status='active'
   where link.auth_user_id=(select auth.uid()) and (select auth.uid()) is not null
 ), visits as (
   select owned.org_id,owned.customer_id,count(a.id)::bigint completed
   from owned left join public.appointments a
     on a.org_id=owned.org_id and a.customer_id=owned.customer_id and a.status='completed'
   group by owned.org_id,owned.customer_id
 ), purchases as (
   select owned.org_id,owned.customer_id,
    count(distinct ord.id) filter(where ord.status='closed')::bigint paid_orders,
    coalesce(sum(p.amount) filter(where p.status='confirmed'),0)::numeric total_paid,
    max(p.paid_at) filter(where p.status='confirmed') as last_paid_at
   from owned
   left join public.service_orders ord
     on ord.org_id=owned.org_id and ord.customer_id=owned.customer_id
   left join public.service_order_payments p
     on p.org_id=ord.org_id and p.order_id=ord.id
   group by owned.org_id,owned.customer_id
 )
 select owned.org_id,o.name::text,
   coalesce(sum(v.completed),0)::bigint,
   coalesce(sum(b.paid_orders),0)::bigint,
   coalesce(sum(b.total_paid),0)::numeric(14,2),
   max(b.last_paid_at)
 from owned
 join public.organizations o on o.id=owned.org_id
 left join visits v on v.org_id=owned.org_id and v.customer_id=owned.customer_id
 left join purchases b on b.org_id=owned.org_id and b.customer_id=owned.customer_id
 group by owned.org_id,o.name
 order by o.name,owned.org_id;
$fn$;
create or replace function public.get_my_customer_loyalty_overview()
returns table(org_id uuid,salon_name text,completed_appointments bigint,paid_orders bigint,
 total_paid numeric,last_paid_at timestamptz)
language sql stable security invoker set search_path='' as $fn$
 select * from private.get_my_customer_loyalty_overview();
$fn$;
revoke all on function private.get_my_customer_loyalty_overview() from public,anon,authenticated;
revoke all on function public.get_my_customer_loyalty_overview() from public,anon,authenticated;
grant execute on function private.get_my_customer_loyalty_overview() to authenticated;
grant execute on function public.get_my_customer_loyalty_overview() to authenticated;
commit;
