-- Matriz de auditoria de leitura com fixtures descartáveis. Executar apenas em QA.
-- Verifica as políticas de leitura para papéis do aplicativo em duas organizações.
-- Usa o schema de QA e o identificador de sessão lido por auth.uid().
-- Retorna as linhas observadas e reverte as fixtures na mesma sessão.
begin;

insert into auth.users (id, email, raw_user_meta_data)
select ('a7d10000-0000-4000-8000-00000000000' || actor.number)::uuid,
       'audit-' || actor.number || '@salaopremium.test',
       actor.metadata::jsonb
from (values
  (1, '{"organization_name":"RLS matriz QA A"}'),
  (2, '{"organization_name":"RLS matriz QA B"}'),
  (3, '{"account_type":"staff"}'),
  (4, '{"account_type":"staff"}'),
  (5, '{"account_type":"professional"}'),
  (6, '{"account_type":"staff"}'),
  (7, '{"account_type":"staff"}'),
  (8, '{"account_type":"staff"}')
) as actor(number, metadata);

insert into public.branches (org_id, name)
select id, 'Filial RLS QA' from public.organizations where name = 'RLS matriz QA A';

insert into public.org_memberships (org_id, user_id, role)
select o.id, ('a7d10000-0000-4000-8000-00000000000' || actor.number)::uuid, actor.role
from public.organizations o
cross join (values (3, 'manager'), (4, 'receptionist'), (5, 'professional'),
                   (6, 'admin'), (7, 'finance')) as actor(number, role)
where o.name = 'RLS matriz QA A';

insert into public.professionals (org_id, branch_id, profile_id, name, access_enabled)
select o.id,b.id,'a7d10000-0000-4000-8000-000000000005','RLS QA Profissional',true
from public.organizations o join public.branches b on b.org_id=o.id and b.is_main
where o.name='RLS matriz QA A';

insert into public.customers (org_id, branch_id, name)
select o.id, b.id,
       case when o.name = 'RLS matriz QA B' then 'RLS Audit B'
            when b.is_main then 'RLS Audit A Matriz' else 'RLS Audit A Filial' end
from public.organizations o join public.branches b on b.org_id = o.id
where o.name in ('RLS matriz QA A','RLS matriz QA B');

create temporary table audit_observations (
  actor text, organizations bigint, branches bigint, customers text[]
) on commit drop;
grant insert on audit_observations to authenticated;

set local role authenticated;
do $audit$
declare
  actor record;
begin
  for actor in select * from (values
    (1,'proprietário A'), (2,'proprietário B'), (3,'gerente A'),
    (4,'recepção A'), (5,'profissional A'), (6,'administrador A'),
    (7,'financeiro A'), (8,'conta sem vínculo')
  ) as actors(number, label)
  loop
    perform set_config('request.jwt.claim.sub', 'a7d10000-0000-4000-8000-00000000000' || actor.number, true);
    insert into audit_observations
    select actor.label,
           (select count(*) from public.organizations where name like 'RLS matriz QA %'),
           (select count(*) from public.branches where org_id in (
              select id from public.organizations where name like 'RLS matriz QA %'
            )),
           (select coalesce(array_agg(name order by name), array[]::text[])
              from public.customers where name like 'RLS Audit %');
  end loop;
end
$audit$;
reset role;
select * from audit_observations order by actor;
rollback;
