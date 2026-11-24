-- Verifica pagamentos da Comanda e devolução integral no Supabase de QA.
-- Usa fixtures de organização, unidade e produto, executa as RPCs do aplicativo
-- com papel autenticado e reverte todos os dados ao final. Executar apenas em QA.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a7d20000-0000-4000-8000-000000000001', 'payment-audit@salaopremium.test',
   '{"organization_name":"QA pagamento transacional"}'),
  ('a7d20000-0000-4000-8000-000000000002', 'payment-manager-audit@salaopremium.test',
   '{"account_type":"staff"}');

create temporary table payment_audit_fixture on commit drop as
select o.id as org_id, b.id as branch_id, gen_random_uuid() as order_id,
       gen_random_uuid() as product_id
from public.organizations o
join public.branches b on b.org_id = o.id and b.is_main
join public.org_memberships m on m.org_id = o.id
where m.user_id = 'a7d20000-0000-4000-8000-000000000001';

insert into public.org_memberships (org_id, user_id, role)
select org_id, 'a7d20000-0000-4000-8000-000000000002', 'manager' from payment_audit_fixture;

insert into public.products (id, org_id, branch_id, name, sale_price, stock_quantity)
select product_id, org_id, branch_id, 'Produto QA pagamento', 100.03, 2
from payment_audit_fixture;

insert into public.service_orders (id, org_id, branch_id)
select order_id, org_id, branch_id from payment_audit_fixture;

insert into public.service_order_items
  (org_id, order_id, item_type, product_id, description, quantity, unit_price, total)
select org_id, order_id, 'product', product_id, 'Produto QA pagamento', 1, 100.03, 100.03
from payment_audit_fixture;

grant select on payment_audit_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7d20000-0000-4000-8000-000000000001', true);

do $audit$
declare
  fixture record;
  result jsonb;
  register_id uuid;
  sale_id uuid;
  confirmed_amount numeric;
  refunded_amount numeric;
begin
  select * into strict fixture from payment_audit_fixture;

  begin
    perform public.register_service_order_payment(fixture.order_id, 40.01, 'pix');
    raise exception 'Pagamento sem Caixa foi aceito';
  exception when raise_exception then
    if sqlerrm <> 'Abra o Caixa antes de receber pagamentos.' then raise; end if;
  end;

  result := public.open_cash_register_for_branch(fixture.org_id, fixture.branch_id, 10.25);
  register_id := (result->>'cash_register_id')::uuid;
  if register_id is null then raise exception 'Caixa da fixture não abriu'; end if;

  begin
    perform public.register_service_order_payment(fixture.order_id, 0.001, 'cash');
    raise exception 'Fração de centavo foi aceita';
  exception when invalid_parameter_value then null;
  end;

  perform set_config('request.jwt.claim.sub', 'a7d20000-0000-4000-8000-000000000002', true);
  begin
    perform public.register_service_order_payment(fixture.order_id, 40.01, 'pix');
    raise exception 'Gerente sem atribuição conseguiu receber pagamento';
  exception when insufficient_privilege then
    if sqlerrm <> 'Sem permissão para operar nesta unidade.' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', 'a7d20000-0000-4000-8000-000000000001', true);
  insert into public.branch_memberships (org_id, branch_id, user_id)
  values (fixture.org_id, fixture.branch_id, 'a7d20000-0000-4000-8000-000000000002');

  perform set_config('request.jwt.claim.sub', 'a7d20000-0000-4000-8000-000000000002', true);
  result := public.register_service_order_payment(fixture.order_id, 40.01, 'pix');
  perform set_config('request.jwt.claim.sub', 'a7d20000-0000-4000-8000-000000000001', true);
  if (result->>'paid_total')::numeric is distinct from 40.01
     or (result->>'balance')::numeric is distinct from 60.02
     or (result->>'closed')::boolean is distinct from false then
    raise exception 'Pagamento parcial incorreto';
  end if;

  begin
    perform public.register_service_order_payment(fixture.order_id, 60.03, 'cash');
    raise exception 'Pagamento acima do saldo foi aceito';
  exception when raise_exception then
    if sqlerrm <> 'O pagamento ultrapassa o saldo da comanda.' then raise; end if;
  end;

  result := public.register_service_order_payment(fixture.order_id, 60.02, 'cash');
  sale_id := (result->>'sale_id')::uuid;
  if sale_id is null or (result->>'closed')::boolean is distinct from true
     or (result->>'balance')::numeric is distinct from 0
     or (select stock_quantity from public.products where id = fixture.product_id) is distinct from 1 then
    raise exception 'Quitação, venda ou estoque incorretos';
  end if;

  begin
    perform public.register_service_order_payment(fixture.order_id, 60.02, 'cash');
    raise exception 'Pagamento repetido após quitação foi aceito';
  exception when raise_exception then
    if sqlerrm <> 'Esta comanda não aceita pagamentos.' then raise; end if;
  end;

  result := public.get_cash_register_summary(register_id);
  if (result->>'expected_cash')::numeric is distinct from 70.27 then
    raise exception 'Saldo físico incorreto após quitação';
  end if;

  result := public.refund_service_order(fixture.order_id, true, 'Auditoria QA');
  if (result->>'refunded_amount')::numeric is distinct from 100.03
     or (result->>'refunded_payments')::integer is distinct from 2
     or (select status from public.service_orders where id = fixture.order_id) is distinct from 'cancelled'
     or (select status from public.sales where id = sale_id) is distinct from 'refunded'
     or (select stock_quantity from public.products where id = fixture.product_id) is distinct from 2 then
    raise exception 'Devolução, venda, comanda ou reposição de estoque incorreta';
  end if;

  begin
    perform public.refund_service_order(fixture.order_id, true, 'Auditoria QA duplicada');
    raise exception 'Devolução repetida foi aceita';
  exception when raise_exception then
    if sqlerrm <> 'A devolução se aplica somente a comandas quitadas. Para as demais, use o cancelamento.' then raise; end if;
  end;

  select sum(amount) filter (where movement_type = 'income'),
         sum(amount) filter (where movement_type = 'expense')
  into confirmed_amount, refunded_amount
  from public.cash_movements
  where cash_register_id = register_id and service_order_id = fixture.order_id;

  result := public.get_cash_register_summary(register_id);
  if confirmed_amount is distinct from 100.03 or refunded_amount is distinct from 100.03
     or (result->>'expected_cash')::numeric is distinct from 10.25 then
    raise exception 'Movimentos ou saldo final do Caixa incorretos';
  end if;
end
$audit$;

reset role;
select 'pagamentos e devolução integral da Comanda' as scenario, 'ok' as result;
rollback;
