-- Somente leitura, antes de ativar as restrições de escopo de funcionários.
-- Retorna contagens agregadas, nunca identificadores ou dados de clientes.
select role,count(*) as active_memberships
from public.org_memberships
where status='active' and role in ('owner','admin','manager','receptionist')
group by role order by role;

select to_regclass('public.branch_memberships') is not null as assignment_table_exists,
 to_regprocedure('private.has_staff_branch_scope(uuid,uuid)') is not null as scope_helper_exists;

select tablename,policyname,permissive
from pg_policies where schemaname='public' and policyname like '%staff_branch_scope%'
order by tablename,policyname;

-- Após criar a tabela de atribuições e antes de ativar políticas, verificar
-- se todo gerente/recepção ativo tem ao menos uma unidade ativa atribuída.
-- Executar separadamente apenas quando branch_memberships existir:
-- select m.role,count(*) as without_active_branch
-- from public.org_memberships m
-- where m.status='active' and m.role in ('manager','receptionist')
-- and not exists(select 1 from public.branch_memberships bm
-- join public.branches b on b.org_id=bm.org_id and b.id=bm.branch_id and b.active
-- where bm.org_id=m.org_id and bm.user_id=m.user_id)
-- group by m.role;
