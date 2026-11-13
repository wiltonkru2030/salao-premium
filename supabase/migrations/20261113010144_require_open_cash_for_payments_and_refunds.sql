-- 20261113010144_require_open_cash_for_payments_and_refunds
-- RPCs de abertura/fechamento, agrupamento de atendimentos e cancelamento auditável.
CREATE OR REPLACE FUNCTION public.open_cash_register(p_org_id uuid, p_opening_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid());v_id uuid;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 if p_opening_amount is null or p_opening_amount<0 then raise exception 'Valor inicial inválido.'; end if;
 if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist','finance']) then raise exception 'Sem permissão para abrir o Caixa.'; end if;
 perform 1 from public.organizations where id=p_org_id for update;
 if exists(select 1 from public.cash_registers where org_id=p_org_id and branch_id is null and status='open') then raise exception 'Já existe um caixa aberto para esta unidade.'; end if;
 insert into public.cash_registers(org_id,branch_id,opening_amount,status,opened_by) values(p_org_id,null,p_opening_amount,'open',v_user) returning id into v_id;
 return jsonb_build_object('cash_register_id',v_id,'opening_amount',p_opening_amount,'status','open');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.close_cash_register(p_cash_register_id uuid, p_closing_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid());v_register public.cash_registers%rowtype;v_expected numeric;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 if p_closing_amount is null or p_closing_amount<0 then raise exception 'Valor contado inválido.'; end if;
 select * into v_register from public.cash_registers where id=p_cash_register_id for update;
 if not found then raise exception 'Caixa não encontrado.'; end if;
 if not private.has_org_role(v_register.org_id,array['owner','admin','manager','receptionist','finance']) then raise exception 'Sem permissão para fechar o Caixa.'; end if;
 if v_register.status<>'open' then raise exception 'Este caixa já foi fechado.'; end if;
 select v_register.opening_amount+coalesce(sum(case when movement_type='income' then amount when movement_type='expense' then -amount else 0 end),0)
  into v_expected from public.cash_movements where org_id=v_register.org_id and cash_register_id=v_register.id;
 update public.cash_registers set closing_amount=p_closing_amount,expected_amount=v_expected,status='closed',closed_by=v_user,closed_at=clock_timestamp() where id=v_register.id;
 return jsonb_build_object('cash_register_id',v_register.id,'expected_amount',v_expected,'closing_amount',p_closing_amount,'difference',p_closing_amount-v_expected,'status','closed');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.start_appointment_group_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_first public.appointments%rowtype;v_row record;v_existing uuid:=p_existing_order_id;v_distinct integer;v_result jsonb;v_count integer:=0;
begin
 select * into v_first from public.appointments where id=p_appointment_id;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
 if v_first.appointment_group_id is null then return public.start_appointment_service_order(p_appointment_id,p_existing_order_id,p_force_new); end if;
 if not private.has_org_role(v_first.org_id,array['owner','admin','manager','receptionist'])
   and private.professional_app_scope(v_first.org_id)<>'all'
   and v_first.professional_id is distinct from private.current_professional_id(v_first.org_id) then
  raise exception 'Sem permissão para iniciar este atendimento.';
 end if;
 select count(distinct service_order_id) into v_distinct from public.appointments
  where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show');
 if v_distinct>1 then raise exception 'Os serviços deste grupo já estão ligados a comandas diferentes. Revise os vínculos antes de continuar.'; end if;
 if v_existing is null and not p_force_new then
  select service_order_id into v_existing from public.appointments
   where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show')
   limit 1;
 end if;
 if p_existing_order_id is not null and v_existing is not null and p_existing_order_id<>v_existing then raise exception 'A comanda escolhida não corresponde ao grupo de atendimento.'; end if;
 for v_row in select id from public.appointments where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id
   and status not in ('cancelled','completed','no_show') order by starts_at,id for update
 loop
  v_result:=public.start_appointment_service_order(v_row.id,v_existing,case when v_count=0 then p_force_new else false end);
  v_existing:=(v_result->>'order_id')::uuid;v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Não há serviços ativos neste atendimento.'; end if;
 update public.appointment_groups set status='in_progress',updated_at=now() where org_id=v_first.org_id and id=v_first.appointment_group_id;
 return v_result||jsonb_build_object('service_count',v_count,'group_id',v_first.appointment_group_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_service_order(p_order_id uuid, p_refund_payments boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid());v_order public.service_orders%rowtype;v_payment record;v_register_id uuid;v_refund_total numeric:=0;v_refund_count integer:=0;v_movement uuid;
begin
 if v_user is null then raise exception 'Autenticação necessária.'; end if;
 select * into v_order from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'Comanda não encontrada.'; end if;
 if not private.has_org_role(v_order.org_id,array['owner','admin','manager','receptionist']) then raise exception 'Sem permissão para cancelar esta comanda.'; end if;
 if v_order.status in ('closed','cancelled') then raise exception 'Esta comanda não pode ser cancelada por este fluxo.'; end if;
 if exists(select 1 from public.commissions c join public.service_order_items i on i.id=c.service_order_item_id where i.org_id=v_order.org_id and i.order_id=v_order.id and c.status='paid') then
  raise exception 'Há comissões já pagas. Faça o ajuste financeiro das comissões antes de cancelar.';
 end if;
 if exists(select 1 from public.service_order_payments p where p.org_id=v_order.org_id and p.order_id=v_order.id and p.status='confirmed') then
  if not p_refund_payments then raise exception 'Esta comanda tem recebimentos. Confirme o estorno integral para cancelar.'; end if;
  if not private.has_org_role(v_order.org_id,array['owner','admin','manager','finance']) then raise exception 'Somente administração ou financeiro pode estornar pagamentos.'; end if;
  select id into v_register_id from public.cash_registers where org_id=v_order.org_id and branch_id is not distinct from v_order.branch_id and status='open' order by opened_at desc limit 1;
  if v_register_id is null then raise exception 'Abra o Caixa da unidade para registrar os estornos.'; end if;
  for v_payment in select * from public.service_order_payments where org_id=v_order.org_id and order_id=v_order.id and status='confirmed' order by paid_at,id for update loop
   insert into public.cash_movements(org_id,branch_id,cash_register_id,service_order_id,movement_type,category,description,amount,payment_method,created_by)
   values(v_order.org_id,v_order.branch_id,v_register_id,v_order.id,'expense','service_order_refund','Estorno do pagamento da Comanda #'||v_order.order_number,v_payment.amount,v_payment.payment_method,v_user)
   returning id into v_movement;
   update public.service_order_payments set status='refunded',refund_cash_movement_id=v_movement,refunded_at=clock_timestamp(),refunded_by=v_user where id=v_payment.id;
   v_refund_total:=v_refund_total+v_payment.amount;v_refund_count:=v_refund_count+1;
  end loop;
  update public.commissions c set status='cancelled'
   where c.org_id=v_order.org_id and c.status in ('pending','approved')
     and c.service_order_payment_id in (select p.id from public.service_order_payments p where p.org_id=v_order.org_id and p.order_id=v_order.id and p.status='refunded');
 end if;
 update public.service_orders set status='cancelled',updated_at=clock_timestamp() where org_id=v_order.org_id and id=v_order.id;
 update public.appointments set status='cancelled',cancelled_at=coalesce(cancelled_at,clock_timestamp())
  where org_id=v_order.org_id and service_order_id=v_order.id and status not in ('cancelled','completed','no_show');
 update public.appointment_groups g set status='cancelled',updated_at=clock_timestamp()
  where g.org_id=v_order.org_id and exists(select 1 from public.appointments a where a.org_id=v_order.org_id and a.appointment_group_id=g.id and a.service_order_id=v_order.id)
    and not exists(select 1 from public.appointments a where a.org_id=v_order.org_id and a.appointment_group_id=g.id and a.status not in ('cancelled','completed','no_show'));
 return jsonb_build_object('order_id',v_order.id,'status','cancelled','refunded_amount',v_refund_total,'refunded_payments',v_refund_count);
end;
$function$
;
revoke all on function public.open_cash_register(uuid,numeric) from public,anon;
revoke all on function public.close_cash_register(uuid,numeric) from public,anon;
revoke all on function public.start_appointment_group_service_order(uuid,uuid,boolean) from public,anon;
revoke all on function public.cancel_service_order(uuid,boolean) from public,anon;
grant execute on function public.open_cash_register(uuid,numeric) to authenticated;
grant execute on function public.close_cash_register(uuid,numeric) to authenticated;
grant execute on function public.start_appointment_group_service_order(uuid,uuid,boolean) to authenticated;
grant execute on function public.cancel_service_order(uuid,boolean) to authenticated;
