-- RASCUNHO — compensação de comissões já pagas após devolução total de comanda.
-- Não aplicar em produção sem revisão e autorização explícita.
-- Reversões negativas são abatidas automaticamente dos próximos repasses líquidos.

begin;

grant usage on schema private to authenticated;

alter table public.commissions
  add column if not exists reversal_of_commission_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='commissions_reversal_of_commission_fk'
      and conrelid='public.commissions'::regclass
  ) then
    alter table public.commissions
      add constraint commissions_reversal_of_commission_fk
      foreign key (reversal_of_commission_id)
      references public.commissions(id) on delete restrict;
  end if;
end;
$$;

create unique index if not exists commissions_reversal_source_unique
  on public.commissions(reversal_of_commission_id)
  where reversal_of_commission_id is not null;

alter table public.commission_payout_items
  drop constraint if exists commission_payout_items_amount_check;

comment on column public.commissions.reversal_of_commission_id is
  'Comissão original já paga que está sendo debitada em repasse futuro após estorno/devolução.';

CREATE OR REPLACE FUNCTION private.refund_service_order(p_order_id uuid, p_return_stock boolean DEFAULT true, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid()); v_order public.service_orders%rowtype; v_register uuid; v_payment record;
        v_item record; v_comm record; v_move uuid; v_total numeric:=0; v_count int:=0; v_returned int:=0;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_order from public.service_orders where id=p_order_id for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;
  if not private.has_org_role(v_order.org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode devolver uma comanda paga.'; end if;
  if v_order.status<>'closed' then raise exception 'A devolução se aplica somente a comandas quitadas. Para as demais, use o cancelamento.'; end if;
  select id into v_register from public.cash_registers
   where org_id=v_order.org_id and (branch_id is not distinct from v_order.branch_id or branch_id is null) and status='open'
   order by (branch_id is not null) desc,opened_at desc limit 1 for update;
  if v_register is null then raise exception 'Abra o Caixa para registrar a devolução.'; end if;
  for v_payment in select * from public.service_order_payments
                    where org_id=v_order.org_id and order_id=v_order.id and status='confirmed' order by paid_at,id for update loop
    insert into public.cash_movements(org_id,branch_id,cash_register_id,service_order_id,movement_type,category,description,amount,payment_method,created_by)
    values(v_order.org_id,v_order.branch_id,v_register,v_order.id,'expense','service_order_refund',
           'Devolução da Comanda #'||v_order.order_number||coalesce(' · '||nullif(btrim(p_reason),''),''),v_payment.amount,v_payment.payment_method,v_user)
    returning id into v_move;
    update public.service_order_payments set status='refunded',refund_cash_movement_id=v_move,refunded_at=clock_timestamp(),refunded_by=v_user
     where id=v_payment.id;
    v_total:=v_total+v_payment.amount; v_count:=v_count+1;
  end loop;
  update public.commissions c set status='cancelled'
   where c.org_id=v_order.org_id and c.status in ('pending','approved')
     and c.service_order_item_id in (select i.id from public.service_order_items i where i.org_id=v_order.org_id and i.order_id=v_order.id);
  for v_comm in
    select c.id,c.org_id,c.professional_id,c.sale_id,c.appointment_id,c.item_type,c.base_amount,c.rate,c.amount
      from public.commissions c
      join public.service_order_items i on i.org_id=c.org_id and i.id=c.service_order_item_id
     where i.org_id=v_order.org_id and i.order_id=v_order.id
       and c.status='paid' and c.reversal_of_commission_id is null
     order by c.created_at,c.id
     for update of c
  loop
    insert into public.commissions(
      org_id,professional_id,sale_id,appointment_id,item_type,
      base_amount,rate,amount,status,reversal_of_commission_id
    ) values (
      v_comm.org_id,v_comm.professional_id,v_comm.sale_id,v_comm.appointment_id,v_comm.item_type,
      -abs(coalesce(v_comm.base_amount,0)),coalesce(v_comm.rate,0),
      -abs(coalesce(v_comm.amount,0)),'pending',v_comm.id
    )
    on conflict (reversal_of_commission_id)
      where reversal_of_commission_id is not null do nothing;
  end loop;
  if v_order.sale_id is not null then
    update public.sales set status='refunded' where org_id=v_order.org_id and id=v_order.sale_id;
  end if;
  if coalesce(p_return_stock,true) then
    for v_item in select * from public.service_order_items
                   where org_id=v_order.org_id and order_id=v_order.id and item_type='product' and product_id is not null loop
      update public.products set stock_quantity=stock_quantity+v_item.quantity,updated_at=clock_timestamp()
       where org_id=v_order.org_id and id=v_item.product_id;
      insert into public.inventory_movements(org_id,branch_id,product_id,movement_type,quantity,reason,reference_id,created_by)
      values(v_order.org_id,v_order.branch_id,v_item.product_id,'in',v_item.quantity,'Devolução da comanda #'||v_order.order_number,v_order.id,v_user);
      v_returned:=v_returned+1;
    end loop;
  end if;
  update public.service_orders set status='cancelled',updated_at=clock_timestamp() where id=v_order.id;
  return jsonb_build_object('order_id',v_order.id,'status','cancelled','refunded_amount',v_total,'refunded_payments',v_count,'returned_products',v_returned);
end $function$


create or replace function public.refund_service_order(
  p_order_id uuid,
  p_return_stock boolean default true,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.refund_service_order(p_order_id,p_return_stock,p_reason);
$function$;

revoke all on function private.refund_service_order(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.refund_service_order(uuid,boolean,text) to authenticated;
revoke all on function public.refund_service_order(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.refund_service_order(uuid,boolean,text) to authenticated;

CREATE OR REPLACE FUNCTION private.pay_professional_commissions(p_org_id uuid, p_professional_id uuid, p_commission_ids uuid[], p_payment_method text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid:=(select auth.uid());
  v_branch_id uuid;
  v_register_id uuid;
  v_payout_id uuid;
  v_cash_movement_id uuid;
  v_amount numeric(12,2):=0;
  v_count integer:=0;
  v_expected integer;
  v_selected_found integer:=0;
  v_comm record;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_commission_ids is null or cardinality(p_commission_ids)=0 then
    raise exception 'Selecione pelo menos uma comissão.';
  end if;
  if cardinality(p_commission_ids)<>(select count(distinct item) from unnest(p_commission_ids) as u(item)) then
    raise exception 'A seleção contém comissões repetidas.';
  end if;
  if p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager','finance']) then
    raise exception 'Somente administração ou financeiro pode pagar comissões.';
  end if;

  select count(*) into v_expected from unnest(p_commission_ids);
  select p.branch_id into v_branch_id from public.professionals p
   where p.org_id=p_org_id and p.id=p_professional_id and p.active=true;
  if not found then raise exception 'Profissional não encontrado ou inativo.'; end if;

  for v_comm in
    select c.id,c.amount
      from public.commissions c
     where c.org_id=p_org_id and c.professional_id=p_professional_id
       and (c.id=any(p_commission_ids) or (c.amount<0 and c.reversal_of_commission_id is not null))
       and c.status in ('pending','approved')
       and c.payout_id is null
     order by c.created_at,c.id
     for update
  loop
    v_count:=v_count+1;
    if v_comm.id=any(p_commission_ids) then v_selected_found:=v_selected_found+1; end if;
    v_amount:=v_amount+v_comm.amount;
  end loop;
  if v_selected_found<>v_expected then
    raise exception 'Uma ou mais comissões não estão pendentes, pertencem a outro profissional ou já foram pagas.';
  end if;
  if v_amount<=0 then raise exception 'O valor total das comissões deve ser maior que zero.'; end if;

  select cr.id into v_register_id
    from public.cash_registers cr
   where cr.org_id=p_org_id and cr.status='open'
     and (cr.branch_id is not distinct from v_branch_id or cr.branch_id is null)
   order by (cr.branch_id is not null) desc,cr.opened_at desc
   limit 1 for update;
  if v_register_id is null then raise exception 'Abra o Caixa da unidade antes de pagar comissões.'; end if;

  insert into public.commission_payouts(
    org_id,professional_id,branch_id,cash_register_id,amount,payment_method,notes,paid_by
  ) values(
    p_org_id,p_professional_id,v_branch_id,v_register_id,v_amount,p_payment_method,
    nullif(btrim(p_notes),''),v_user
  ) returning id into v_payout_id;

  insert into public.cash_movements(
    org_id,branch_id,cash_register_id,movement_type,category,description,amount,payment_method,created_by
  ) values(
    p_org_id,v_branch_id,v_register_id,'expense','professional_commission',
    'Pagamento de comissão ao profissional',v_amount,p_payment_method,v_user
  ) returning id into v_cash_movement_id;

  update public.commission_payouts set cash_movement_id=v_cash_movement_id
   where org_id=p_org_id and id=v_payout_id;

  for v_comm in
    select c.id,c.amount
      from public.commissions c
     where c.org_id=p_org_id and c.professional_id=p_professional_id
       and (c.id=any(p_commission_ids) or (c.amount<0 and c.reversal_of_commission_id is not null))
       and c.status in ('pending','approved') and c.payout_id is null
     order by c.created_at,c.id
  loop
    insert into public.commission_payout_items(org_id,payout_id,commission_id,amount)
    values(p_org_id,v_payout_id,v_comm.id,v_comm.amount);
  end loop;

  update public.commissions
     set status='paid',paid_at=clock_timestamp(),payout_id=v_payout_id
   where org_id=p_org_id and professional_id=p_professional_id
     and (id=any(p_commission_ids) or (amount<0 and reversal_of_commission_id is not null))
     and status in ('pending','approved') and payout_id is null;

  return jsonb_build_object(
    'payout_id',v_payout_id,'cash_movement_id',v_cash_movement_id,
    'professional_id',p_professional_id,'amount',v_amount,
    'commission_count',v_count,'paid_at',clock_timestamp()
  );
end;
$function$


create or replace function public.pay_professional_commissions(
  p_org_id uuid,
  p_professional_id uuid,
  p_commission_ids uuid[],
  p_payment_method text,
  p_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.pay_professional_commissions(
    p_org_id,p_professional_id,p_commission_ids,p_payment_method,p_notes
  );
$function$;

revoke all on function private.pay_professional_commissions(uuid,uuid,uuid[],text,text) from public,anon,authenticated;
grant execute on function private.pay_professional_commissions(uuid,uuid,uuid[],text,text) to authenticated;
revoke all on function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) to authenticated;


comment on function public.refund_service_order(uuid,boolean,text) is
  'Devolve comanda quitada; comissões não pagas são canceladas e comissões já pagas geram débitos para o próximo repasse.';
comment on function public.pay_professional_commissions(uuid,uuid,uuid[],text,text) is
  'Paga o saldo líquido das comissões selecionadas, incluindo automaticamente todos os ajustes negativos pendentes do profissional.';

commit;
