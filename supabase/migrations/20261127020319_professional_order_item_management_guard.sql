-- Permissão temporária e privada para mutações específicas já validadas pelo RPC.
-- Não usa GUC de sessão (configurável pelo cliente). Cada autorização é vinculada à transação e ao item.
create table if not exists private.professional_order_item_authorizations(
 transaction_id bigint not null, item_id uuid not null, org_id uuid not null,
 order_id uuid not null, actor_id uuid not null, operation text not null,
 primary key(transaction_id,item_id,operation)
);
alter table private.professional_order_item_authorizations enable row level security;
revoke all on private.professional_order_item_authorizations from public,anon,authenticated;

create or replace function private.enforce_professional_service_order_item()
returns trigger language plpgsql security definer set search_path='' as $$
declare service_name text; service_price numeric; prof uuid;
begin
 if private.has_org_role(new.org_id,array['professional']) then
  prof:=private.current_professional_id(new.org_id);
  if prof is null or new.professional_id is distinct from prof then raise exception 'Item não autorizado.' using errcode='42501'; end if;
  if exists(select 1 from private.professional_order_item_authorizations a
    where a.transaction_id=txid_current() and a.item_id=new.id and a.org_id=new.org_id and a.order_id=new.order_id and a.actor_id=auth.uid() and a.operation=tg_op) then
   return new;
  end if;
  -- Escritas legadas continuam limitadas a serviços com preço do catálogo.
  if new.item_type<>'service' or new.service_id is null then raise exception 'Profissionais só podem registrar serviços realizados.' using errcode='42501'; end if;
  select s.name,s.price into service_name,service_price from public.services s where s.org_id=new.org_id and s.id=new.service_id and s.active;
  if service_name is null then raise exception 'Serviço indisponível.' using errcode='23514'; end if;
  new.description:=service_name;new.quantity:=1;new.unit_price:=service_price;new.discount:=0;new.total:=service_price;new.created_by:=auth.uid();new.performed_at:=coalesce(new.performed_at,now());
 end if;
 return new;
end $$;

-- Reutiliza a API existente; preço, unidade e autoria jamais vêm do cliente.
create or replace function private.professional_order_action(target_org uuid,unit uuid,order_key uuid,operation text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.professionals%rowtype; o public.service_orders%rowtype; item public.service_order_items%rowtype;
 product public.products%rowtype; service public.services%rowtype; q numeric; d numeric; new_id uuid;
begin
 select * into p from public.professionals x where x.org_id=target_org and x.id=private.current_professional_id(target_org) and x.can_edit_own_orders;
 if auth.uid() is null or p.id is null then raise exception 'Comanda não autorizada.' using errcode='42501'; end if;
 if not exists(select 1 from public.branches b where b.id=unit and b.org_id=target_org and b.active and (p.branch_id=b.id or (p.branch_id is null and (b.is_main or unit=any(p.additional_branch_ids))))) then raise exception 'Unidade indisponível.' using errcode='42501'; end if;
 select * into o from public.service_orders x where x.org_id=target_org and x.id=order_key and x.branch_id=unit and x.assigned_professional_id=p.id and x.status in ('open','in_progress') for update;
 if o.id is null then raise exception 'Comanda não autorizada ou indisponível.' using errcode='42501'; end if;
 if exists(select 1 from public.service_order_payments x where x.order_id=o.id and x.org_id=target_org) then raise exception 'Comanda com movimentação financeira.' using errcode='23514'; end if;
 case operation
 when 'products' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'price',x.sale_price) order by x.name),'[]') from public.products x where x.org_id=target_org and x.active and (x.branch_id=unit or x.branch_id is null));
 when 'service' then
  select s.* into service from public.services s join public.professional_services l on l.org_id=s.org_id and l.service_id=s.id and l.professional_id=p.id
   where s.org_id=target_org and s.id=(payload->>'service')::uuid and s.active and s.archived_at is null and (s.branch_id=unit or s.branch_id is null) for share of s;
  if service.id is null then raise exception 'Serviço não autorizado.' using errcode='42501'; end if;
  insert into public.service_order_items(org_id,order_id,item_type,service_id,professional_id,description,quantity,unit_price,discount,total,performed_at,created_by)
   values(target_org,o.id,'service',service.id,p.id,service.name,1,service.price,0,service.price,now(),auth.uid());
 when 'product' then
  select * into product from public.products x where x.org_id=target_org and x.id=(payload->>'product')::uuid and x.active and (x.branch_id=unit or x.branch_id is null) for share;
  if product.id is null then raise exception 'Produto não autorizado.' using errcode='42501'; end if;
  if product.stock_quantity<1 then raise exception 'Produto sem estoque.' using errcode='23514'; end if;
  new_id:=gen_random_uuid();
  insert into private.professional_order_item_authorizations values(txid_current(),new_id,target_org,o.id,auth.uid(),'INSERT');
  insert into public.service_order_items(id,org_id,order_id,item_type,product_id,professional_id,description,quantity,unit_price,discount,total,created_by)
   values(new_id,target_org,o.id,'product',product.id,p.id,product.name,1,product.sale_price,0,product.sale_price,auth.uid());
  delete from private.professional_order_item_authorizations x where x.transaction_id=txid_current() and x.item_id=new_id and x.operation='INSERT';
 when 'edit','remove' then
  select * into item from public.service_order_items x where x.org_id=target_org and x.order_id=o.id and x.id=(payload->>'id')::uuid and x.professional_id=p.id for update;
  if item.id is null then raise exception 'Item não autorizado.' using errcode='42501'; end if;
  if operation='remove' then
   if item.source_appointment_id is not null then raise exception 'Serviço original do atendimento deve ser preservado.' using errcode='23514'; end if;
   delete from public.service_order_items x where x.id=item.id;
  else
   q:=(payload->>'quantity')::numeric;d:=(payload->>'discount')::numeric;
   if q is null or q::text in ('NaN','Infinity','-Infinity') or q not between 1 and 999 or q<>trunc(q) or d is null or d::text in ('NaN','Infinity','-Infinity') or d not between 0 and q*item.unit_price or d<>round(d,2) then raise exception 'Quantidade ou desconto inválido.' using errcode='22023'; end if;
   if item.source_appointment_id is not null and q<>item.quantity then raise exception 'Quantidade do serviço agendado deve ser preservada.' using errcode='23514'; end if;
   if item.item_type='product' and not exists(select 1 from public.products x where x.org_id=target_org and x.id=item.product_id and x.active and (x.branch_id=unit or x.branch_id is null) and x.stock_quantity>=q) then raise exception 'Estoque insuficiente.' using errcode='23514'; end if;
   insert into private.professional_order_item_authorizations values(txid_current(),item.id,target_org,o.id,auth.uid(),'UPDATE');
   update public.service_order_items x set quantity=q,discount=d,total=round(q*item.unit_price-d,2) where x.id=item.id;
   delete from private.professional_order_item_authorizations x where x.transaction_id=txid_current() and x.item_id=item.id and x.operation='UPDATE';
  end if;
 when 'cancel' then
  if exists(select 1 from public.service_order_items x where x.org_id=target_org and x.order_id=o.id and x.professional_id is distinct from p.id)
   or exists(select 1 from public.appointments x where x.org_id=target_org and x.service_order_id=o.id and (x.professional_id is distinct from p.id or x.appointment_group_id is not null or x.status='completed')) then raise exception 'Comanda compartilhada ou concluída: consulte a recepção.' using errcode='23514'; end if;
  update public.service_orders x set status='cancelled',updated_at=now() where x.id=o.id and x.org_id=target_org;
 else raise exception 'Operação indisponível.' using errcode='22023';
 end case;
 return jsonb_build_object('id',o.id);
end $$;
revoke all on function private.professional_order_action(uuid,uuid,uuid,text,jsonb),public.professional_order_action(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.professional_order_action(uuid,uuid,uuid,text,jsonb),public.professional_order_action(uuid,uuid,uuid,text,jsonb) to authenticated;
