-- Testa a autorização de cancelamento de despesas por unidade em QA.
-- Todas as contas e despesas são revertidas ao final da transação.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('a7d90000-0000-4000-8000-000000000001','qa-expense-owner@salaopremium.test','{"organization_name":"QA cancelamento de despesas"}'),
 ('a7d90000-0000-4000-8000-000000000002','qa-expense-manager@salaopremium.test','{"account_type":"staff"}'),
 ('a7d90000-0000-4000-8000-000000000003','qa-expense-reception@salaopremium.test','{"account_type":"staff"}');

insert into public.branches(org_id,name)
select id,'Filial QA cancelamento' from public.organizations where name='QA cancelamento de despesas';

insert into public.org_memberships(org_id,user_id,role)
select id,'a7d90000-0000-4000-8000-000000000002','manager'
from public.organizations where name='QA cancelamento de despesas';
insert into public.org_memberships(org_id,user_id,role)
select id,'a7d90000-0000-4000-8000-000000000003','receptionist'
from public.organizations where name='QA cancelamento de despesas';

insert into public.branch_memberships(org_id,branch_id,user_id)
select org_id,id,'a7d90000-0000-4000-8000-000000000002'
from public.branches where org_id=(select id from public.organizations where name='QA cancelamento de despesas') and is_main;
insert into public.branch_memberships(org_id,branch_id,user_id)
select org_id,id,'a7d90000-0000-4000-8000-000000000003'
from public.branches where name='Filial QA cancelamento';

insert into public.expenses(org_id,branch_id,description,amount)
select org_id,id,case when is_main then 'Despesa matriz QA' else 'Despesa filial QA' end,12.34
from public.branches where org_id=(select id from public.organizations where name='QA cancelamento de despesas');

create temporary table expense_scope_fixture on commit drop as
select (select id from public.expenses where description='Despesa matriz QA' limit 1) as main_id,
       (select id from public.expenses where description='Despesa filial QA' limit 1) as branch_id;
grant select on expense_scope_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','a7d90000-0000-4000-8000-000000000002',true);
do $test$
declare f record;
begin
 select * into strict f from expense_scope_fixture;
 if public.cancel_expense(f.main_id)->>'status' <> 'cancelled' then
   raise exception 'Gerente não cancelou despesa da unidade atribuída';
 end if;
 begin
   perform public.cancel_expense(f.branch_id);
   raise exception 'Gerente cancelou despesa de outra unidade';
 exception when insufficient_privilege then null;
 end;
end $test$;

select set_config('request.jwt.claim.sub','a7d90000-0000-4000-8000-000000000003',true);
do $test$
declare f record;
begin
 select * into strict f from expense_scope_fixture;
 begin
   perform public.cancel_expense(f.branch_id);
   raise exception 'Recepção cancelou despesa';
 exception when raise_exception then
   if sqlerrm <> 'Somente administração ou financeiro pode cancelar despesas.' then raise; end if;
 end;
end $test$;

select set_config('request.jwt.claim.sub','a7d90000-0000-4000-8000-000000000001',true);
do $test$
declare f record;
begin
 select * into strict f from expense_scope_fixture;
 if public.cancel_expense(f.branch_id)->>'status' <> 'cancelled' then
   raise exception 'Proprietário não cancelou despesa da filial';
 end if;
end $test$;
reset role;

select 'cancelamento de despesas por unidade' as scenario,'ok' as result
where (select count(*) from public.expenses where description in ('Despesa matriz QA','Despesa filial QA') and status='cancelled')=2;
rollback;
