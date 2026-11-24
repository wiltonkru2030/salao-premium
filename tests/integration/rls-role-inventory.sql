-- Matriz de auditoria de leitura e escrita com fixtures descartáveis. Executar apenas em QA.
-- Verifica políticas de clientes, despesas e a RPCs de abertura, resumo e fechamento de Caixa para papéis do aplicativo em duas organizações.
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

insert into public.expenses (org_id, branch_id, description, amount)
select o.id, b.id, 'Despesa RLS QA', 25.00
from public.organizations o join public.branches b on b.org_id = o.id
where o.name in ('RLS matriz QA A', 'RLS matriz QA B');

create temporary table audit_targets on commit drop as
select o.id as org_id, b.id as branch_id, c.id as customer_id,
       case when o.name = 'RLS matriz QA B' then 'B'
            when b.is_main then 'A matriz' else 'A filial' end as unit
from public.organizations o
join public.branches b on b.org_id = o.id
join public.customers c on c.org_id = o.id and c.branch_id = b.id
where o.name in ('RLS matriz QA A', 'RLS matriz QA B');

create temporary table audit_writes (
  actor text, unit text, customers_updated bigint, expenses_read bigint, cash_opened boolean
) on commit drop;
grant select on audit_targets to authenticated;
grant insert on audit_writes to authenticated;

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
do $audit$
declare
  actor record;
  target record;
  updated bigint;
  expenses bigint;
  opened boolean;
  cash_result jsonb;
begin
  for actor in select * from (values
    (1, 'proprietário A'), (3, 'gerente A'), (4, 'recepção A'),
    (5, 'profissional A'), (7, 'financeiro A'), (8, 'conta sem vínculo')
  ) as actors(number, label)
  loop
    perform set_config('request.jwt.claim.sub', 'a7d10000-0000-4000-8000-00000000000' || actor.number, true);
    for target in select * from audit_targets loop
      update public.customers set notes = 'Revisão de QA' where id = target.customer_id;
      get diagnostics updated = row_count;
      select count(*) into expenses from public.expenses
        where org_id = target.org_id and branch_id = target.branch_id and description = 'Despesa RLS QA';

      if target.unit = 'B' and (updated <> 0 or expenses <> 0) then
        raise exception 'Acesso fora da organização no cenário %', actor.label;
      end if;

      opened := false;
      begin
        cash_result := public.open_cash_register_for_branch(target.org_id, target.branch_id, 10.25);
        opened := (cash_result->>'status' = 'open'
                   and (cash_result->>'opening_amount')::numeric = 10.25) is true;
        if not opened then
          raise exception 'Abertura sem confirmação no cenário % / %', actor.label, target.unit;
        end if;
        -- Reverte a abertura antes do próximo caso de teste na mesma unidade.
        raise sqlstate 'QA001';
      exception
        when sqlstate 'QA001' then null;
        when raise_exception then
          if sqlerrm <> 'Sem permissão para abrir o Caixa.' then
            raise;
          end if;
      end;

      if opened and (target.unit = 'B' or actor.number in (5, 8)) then
        raise exception 'Abertura indevida no cenário % / %', actor.label, target.unit;
      end if;
      insert into audit_writes values (actor.label, target.unit, updated, expenses, opened);
    end loop;
  end loop;
end
$audit$;
reset role;

-- Os registros e movimentos abaixo isolam o cálculo do fechamento dos fluxos de pagamento.
insert into public.cash_registers (org_id, branch_id, opening_amount, status)
select org_id, branch_id, 10.25, 'open' from audit_targets;

insert into public.cash_movements
  (org_id, branch_id, cash_register_id, movement_type, description, amount, payment_method)
select r.org_id, r.branch_id, r.id, m.kind, 'Movimento RLS QA', m.amount, m.method
from public.cash_registers r
join audit_targets t on t.org_id = r.org_id and t.branch_id = r.branch_id
cross join (values
  ('income', 42.37, 'cash'), ('expense', 7.12, 'cash'),
  ('income', 60.00, 'pix'), ('income', 80.00, 'credit_card')
) as m(kind, amount, method);

create temporary table audit_cash_targets on commit drop as
select r.id, t.unit
from public.cash_registers r
join audit_targets t on t.org_id = r.org_id and t.branch_id = r.branch_id;
grant select on audit_cash_targets to authenticated;

create temporary table audit_closures (
  actor text, unit text, summary_allowed boolean, close_allowed boolean
) on commit drop;
grant insert on audit_closures to authenticated;

set local role authenticated;
do $audit$
declare
  actor record;
  target record;
  allowed boolean;
  summary_ok boolean;
  close_ok boolean;
  result jsonb;
begin
  for actor in select * from (values
    (1, 'proprietário A', true), (3, 'gerente A', true),
    (4, 'recepção A', true), (5, 'profissional A', false),
    (7, 'financeiro A', true), (8, 'conta sem vínculo', false)
  ) as actors(number, label, cash_access)
  loop
    perform set_config('request.jwt.claim.sub', 'a7d10000-0000-4000-8000-00000000000' || actor.number, true);
    for target in select * from audit_cash_targets loop
      allowed := actor.cash_access and target.unit <> 'B';
      summary_ok := false;
      close_ok := false;
      begin
        result := public.get_cash_register_summary(target.id);
        if (result->>'expected_cash')::numeric is distinct from 45.50
           or (result->>'cash_income')::numeric is distinct from 42.37
           or (result->>'cash_expense')::numeric is distinct from 7.12 then
          raise exception 'Resumo incorreto no cenário % / %', actor.label, target.unit;
        end if;
        summary_ok := true;
      exception
        when raise_exception then
          if sqlerrm <> 'Sem permissão para consultar o resumo do Caixa.' then raise; end if;
      end;

      begin
        result := public.close_cash_register(target.id, 44.25);
        if result->>'status' is distinct from 'closed'
           or (result->>'expected_amount')::numeric is distinct from 45.50
           or (result->>'closing_amount')::numeric is distinct from 44.25
           or (result->>'difference')::numeric is distinct from -1.25 then
          raise exception 'Fechamento incorreto no cenário % / %', actor.label, target.unit;
        end if;
        begin
          perform public.close_cash_register(target.id, 44.25);
          raise exception 'Segundo fechamento aceito no cenário % / %', actor.label, target.unit;
        exception
          when raise_exception then
            if sqlerrm <> 'Este caixa já foi fechado.' then raise; end if;
        end;
        close_ok := true;
        -- Reabre a fixture por rollback antes de testar a próxima conta.
        raise sqlstate 'QA001';
      exception
        when sqlstate 'QA001' then null;
        when raise_exception then
          if sqlerrm <> 'Sem permissão para fechar o Caixa.' then raise; end if;
      end;

      if summary_ok is distinct from allowed or close_ok is distinct from allowed then
        raise exception 'Permissões de Caixa divergentes no cenário % / %', actor.label, target.unit;
      end if;
      insert into audit_closures values (actor.label, target.unit, summary_ok, close_ok);
    end loop;
  end loop;
end
$audit$;
reset role;

select jsonb_build_object(
  'read', (select jsonb_agg(to_jsonb(r) order by actor) from audit_observations r),
  'write', (select jsonb_agg(to_jsonb(w) order by actor, unit) from audit_writes w),
  'closure_cases', (select count(*) from audit_closures),
  'closure_allowed', (select count(*) from audit_closures where summary_allowed and close_allowed)
) as result;
rollback;
