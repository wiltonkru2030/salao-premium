-- CANDIDATA: integridade Agenda/Comanda. Validar em QA antes de aplicar.
-- Preserva contratos públicos e ACL; não altera dados históricos.
begin;
CREATE OR REPLACE FUNCTION private.start_appointment_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_appt public.appointments%rowtype; v_order public.service_orders%rowtype; v_created boolean:=false; v_group_id uuid; v_item_order_id uuid; v_target_order_id uuid; v_user uuid:=(select auth.uid());
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  -- Bloqueia o grupo antes de qualquer agendamento, inclusive na chamada individual.
  select appointment_group_id into v_group_id from public.appointments where id=p_appointment_id;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_group_id is not null then
    perform 1 from public.appointment_groups where id=v_group_id for update;
    if not found then raise exception 'Grupo de atendimento não encontrado.'; end if;
  end if;
  select * into v_appt from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_appt.appointment_group_id is distinct from v_group_id then raise exception 'O grupo foi alterado. Atualize a agenda.'; end if;
  if not coalesce((
    private.has_org_role(v_appt.org_id,array['owner','admin','manager','receptionist'])
    or private.professional_app_scope(v_appt.org_id)='all'
    or v_appt.professional_id=private.current_professional_id(v_appt.org_id)
  ),false) then raise exception 'Sem permissão para iniciar este atendimento.'; end if;
  if v_appt.status in ('cancelled','completed','no_show') then raise exception 'Este agendamento não pode iniciar atendimento.'; end if;
  if v_appt.service_id is null then raise exception 'Vincule um serviço ao agendamento antes de iniciar.'; end if;
  -- Um item já registrado é a referência definitiva; nunca criar outra comanda para ele.
  select order_id into v_item_order_id from public.service_order_items
    where org_id=v_appt.org_id and source_appointment_id=v_appt.id;
  if v_item_order_id is not null and v_appt.service_order_id is not null
    and v_item_order_id<>v_appt.service_order_id then
    raise exception 'O vínculo da comanda diverge do item registrado. Solicite revisão.';
  end if;
  v_target_order_id:=coalesce(v_item_order_id,v_appt.service_order_id,p_existing_order_id);
  if p_existing_order_id is not null and p_existing_order_id is distinct from v_target_order_id then
    raise exception 'Este atendimento já está vinculado a outra comanda.';
  end if;
  if v_target_order_id is not null then
    select * into v_order from public.service_orders
      where org_id=v_appt.org_id and id=v_target_order_id and customer_id=v_appt.customer_id
      and branch_id is not distinct from v_appt.branch_id
      and status in ('open','in_progress','partially_paid','awaiting_payment') for update;
    if not found then raise exception 'A comanda não está disponível para este cliente e unidade.'; end if;
    if v_item_order_id is null and (v_order.status not in ('open','in_progress') or exists(
      select 1 from public.service_order_payments p where p.org_id=v_order.org_id and p.order_id=v_order.id and p.status='confirmed'
    )) then raise exception 'Não é possível adicionar atendimento a uma comanda com pagamento iniciado.'; end if;
  end if;
  if v_order.id is null then
    insert into public.service_orders(org_id,branch_id,customer_id,appointment_id,assigned_professional_id,status,notes,created_by,created_by_type)
    values(v_appt.org_id,v_appt.branch_id,v_appt.customer_id,v_appt.id,v_appt.professional_id,'in_progress',
      v_appt.notes,v_user,case when private.has_org_role(v_appt.org_id,array['professional']) then 'professional' else 'salon' end)
    returning * into v_order;
    v_created:=true;
  elsif v_order.status='open' then
    update public.service_orders set status='in_progress',updated_at=now()
     where id=v_order.id and org_id=v_order.org_id returning * into v_order;
  end if;
  if v_item_order_id is null then
    insert into public.service_order_items(org_id,order_id,item_type,service_id,professional_id,source_appointment_id,description,quantity,unit_price,discount,total,performed_at,created_by)
    values(v_appt.org_id,v_order.id,'service',v_appt.service_id,v_appt.professional_id,v_appt.id,
      v_appt.service_name,1,v_appt.price,0,v_appt.price,now(),v_user);
  end if;
  update public.appointments set service_order_id=v_order.id,
    comanda_strategy=case when v_created then 'new_on_arrival' else 'reuse_open' end,
    status='in_progress',arrived_at=coalesce(arrived_at,now()),updated_at=now()
   where org_id=v_appt.org_id and id=v_appt.id;
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'created',v_created,'reused',not v_created,'status',v_order.status);
end;
$function$;

CREATE OR REPLACE FUNCTION private.start_appointment_group_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_first public.appointments%rowtype;v_row record;v_existing uuid:=p_existing_order_id;v_distinct integer;v_result jsonb;v_count integer:=0;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 select * into v_first from public.appointments where id=p_appointment_id;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
 if v_first.appointment_group_id is null then return public.start_appointment_service_order(p_appointment_id,p_existing_order_id,p_force_new); end if;
 if not coalesce((private.has_org_role(v_first.org_id,array['owner','admin','manager','receptionist'])
   or private.professional_app_scope(v_first.org_id)='all'
   or v_first.professional_id=private.current_professional_id(v_first.org_id)),false) then
  raise exception 'Sem permissão para iniciar este atendimento.';
 end if;
 -- Serializa chamadas iniciadas por qualquer atendimento do mesmo grupo.
 perform 1 from public.appointment_groups where org_id=v_first.org_id and id=v_first.appointment_group_id for update;
 if not found then raise exception 'Grupo de atendimento não encontrado.'; end if;
 perform 1 from public.appointments where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id order by id for update;
 if not exists(select 1 from public.appointments where id=p_appointment_id and org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id) then
   raise exception 'O grupo foi alterado. Atualize a agenda.';
 end if;
 if exists(select 1 from public.appointments a where a.org_id=v_first.org_id and a.appointment_group_id=v_first.appointment_group_id
   and a.status not in ('cancelled','completed','no_show')
   and (a.customer_id is distinct from v_first.customer_id or a.branch_id is distinct from v_first.branch_id)) then
   raise exception 'O grupo possui atendimentos de clientes ou unidades diferentes.';
 end if;
 select count(distinct service_order_id) into v_distinct from public.appointments
  where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show');
 if v_distinct>1 then raise exception 'Os serviços deste grupo já estão ligados a comandas diferentes. Revise os vínculos antes de continuar.'; end if;
 -- Um vínculo já existente prevalece sobre forçar nova comanda.
 select service_order_id into v_existing from public.appointments
   where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id and service_order_id is not null and status not in ('cancelled','completed','no_show')
   limit 1;
 if v_existing is not null and p_existing_order_id is not null and p_existing_order_id<>v_existing then raise exception 'A comanda escolhida não corresponde ao grupo de atendimento.'; end if;
 v_existing:=coalesce(v_existing,p_existing_order_id);
 for v_row in select id from public.appointments where org_id=v_first.org_id and appointment_group_id=v_first.appointment_group_id
   and status not in ('cancelled','completed','no_show') order by starts_at,id for update
 loop
  v_result:=public.start_appointment_service_order(v_row.id,v_existing,case when v_count=0 and v_existing is null then coalesce(p_force_new,false) else false end);
  v_existing:=(v_result->>'order_id')::uuid;v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Não há serviços ativos neste atendimento.'; end if;
 update public.appointment_groups set status='in_progress',updated_at=now() where org_id=v_first.org_id and id=v_first.appointment_group_id;
 return v_result||jsonb_build_object('service_count',v_count,'group_id',v_first.appointment_group_id);
end;
$function$;
commit;
