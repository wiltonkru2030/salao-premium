-- Homologa no Supabase de QA a conversão do orçamento e o recebimento do grupo.
-- Usa uma proprietária, dois profissionais e duas comissões; reverte a fixture.
begin;

insert into auth.users (id, email, raw_user_meta_data)
values ('a7d30000-0000-4000-8000-000000000001', 'quote-group-audit@salaopremium.test',
        '{"organization_name":"QA orçamento em grupo"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7d30000-0000-4000-8000-000000000001', true);

do $audit$
<<quote_group_audit>>
declare
  tenant uuid;
  branch uuid;
  customer uuid;
  service_a uuid;
  service_b uuid;
  professional_a uuid;
  professional_b uuid;
  quote_id uuid;
  group_id uuid;
  appointment_id uuid;
  order_id uuid;
  starts timestamptz := date_trunc('week', now()) + interval '15 days 14 hours';
  slots jsonb;
  result jsonb;
begin
  select m.org_id into strict tenant from public.org_memberships m where m.user_id = auth.uid();
  select b.id into strict branch from public.branches b where b.org_id = tenant and b.is_main;

  insert into public.customers (org_id, branch_id, name) values (tenant, branch, 'Cliente QA grupo') returning id into customer;
  insert into public.services (org_id, branch_id, name, price, duration_minutes)
    values (tenant, branch, 'Corte QA', 100, 30) returning id into service_a;
  insert into public.services (org_id, branch_id, name, price, duration_minutes)
    values (tenant, branch, 'Escova QA', 50, 45) returning id into service_b;
  insert into public.professionals (org_id, branch_id, name, commission_rate)
    values (tenant, branch, 'Profissional QA A', 50) returning id into professional_a;
  insert into public.professionals (org_id, branch_id, name, commission_rate)
    values (tenant, branch, 'Profissional QA B', 40) returning id into professional_b;
  insert into public.professional_services (org_id, professional_id, service_id)
    values (tenant, professional_a, service_a), (tenant, professional_b, service_b);

  insert into public.branch_business_hours (org_id, branch_id, weekday, opens_at, closes_at)
    values (tenant, branch, 2, '08:00', '20:00');
  insert into public.professional_working_hours (org_id, professional_id, weekday, starts_at, ends_at)
    values (tenant, professional_a, 2, '08:00', '20:00'), (tenant, professional_b, 2, '08:00', '20:00');

  result := public.create_quote_with_items(tenant, branch, customer, null, 'QA grupo',
    jsonb_build_array(
      jsonb_build_object('service_id', service_a, 'professional_id', professional_a, 'quantity', 1, 'discount_mode', 'percent', 'discount_value', 0),
      jsonb_build_object('service_id', service_b, 'professional_id', professional_b, 'quantity', 1, 'discount_mode', 'percent', 'discount_value', 0)));
  quote_id := (result->>'id')::uuid;
  update public.quotes q set status = 'accepted', accepted_at = now() where q.id = quote_id;
  select jsonb_agg(jsonb_build_object('quote_item_id', qi.id, 'professional_id', qi.professional_id,
    'starts_at', starts + case when qi.service_id = service_a then interval '0 minutes' else interval '30 minutes' end,
    'ends_at', starts + case when qi.service_id = service_a then interval '30 minutes' else interval '75 minutes' end)
    order by qi.sort_order)
    into slots from public.quote_items qi where qi.quote_id = quote_group_audit.quote_id;
  result := public.create_quote_appointment_group(quote_id, slots);
  group_id := (result->>'group_id')::uuid;
  if (select count(*) from public.appointments a
      where a.appointment_group_id = group_id and a.branch_id = branch
        and ((a.service_id = service_a and a.professional_id = professional_a)
          or (a.service_id = service_b and a.professional_id = professional_b))) <> 2 then
    raise exception 'O grupo não preservou os vínculos dos dois serviços.';
  end if;
  if exists (select from public.cash_movements m where m.org_id = tenant)
     or exists (select from public.commissions c where c.org_id = tenant) then
    raise exception 'O agendamento já criou movimento financeiro.';
  end if;

  select a.id into strict appointment_id from public.appointments a
    where a.appointment_group_id = group_id and a.professional_id = professional_a;
  result := public.start_appointment_group_service_order(appointment_id, null, false);
  order_id := (result->>'order_id')::uuid;
  if order_id is null or (result->>'service_count')::int is distinct from 2 then
    raise exception 'O grupo não abriu uma única comanda para os dois serviços.';
  end if;
  perform public.open_cash_register_for_branch(tenant, branch, 10);
  perform public.register_service_order_payment(order_id, 60, 'pix');
  perform public.register_service_order_payment(order_id, 90, 'cash');

  if (select sum(c.amount) from public.commissions c where c.org_id = tenant and c.professional_id = professional_a) is distinct from 50
    or (select sum(c.amount) from public.commissions c where c.org_id = tenant and c.professional_id = professional_b) is distinct from 20 then
    raise exception 'O rateio não corresponde aos R$ 50 e R$ 20 devidos aos profissionais.';
  end if;
end;
$audit$;

rollback;
select 'Orçamento, Agenda, Comanda, Caixa e Comissões verificados em transação revertida' as resultado;
