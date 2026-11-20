-- Candidata: início de atendimento idempotente, preservando unidade e status financeiro.
-- Não aplicar antes de verificar duplicatas legadas e integração com grupos.
begin;
CREATE OR REPLACE FUNCTION private.start_appointment_service_order(p_appointment_id uuid, p_existing_order_id uuid DEFAULT NULL::uuid, p_force_new boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_appt public.appointments%rowtype; v_order public.service_orders%rowtype; v_created boolean:=false; v_linked_order_id uuid; v_user uuid:=(select auth.uid());
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_appt from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if not (
    private.has_org_role(v_appt.org_id,array['owner','admin','manager','receptionist'])
    or private.professional_app_scope(v_appt.org_id)='all'
    or v_appt.professional_id=private.current_professional_id(v_appt.org_id)
  ) then raise exception 'Sem permissão para iniciar este atendimento.'; end if;
  if v_appt.status in ('cancelled','completed','no_show') then raise exception 'Este agendamento não pode iniciar atendimento.'; end if;
  if v_appt.service_id is null then raise exception 'Vincule um serviço ao agendamento antes de iniciar.'; end if;
  -- O item de origem é o vínculo definitivo; uma repetição nunca cria outra comanda.
  select i.order_id into v_linked_order_id from public.service_order_items i
   where i.org_id=v_appt.org_id and i.source_appointment_id=v_appt.id;
  if v_linked_order_id is not null and v_appt.service_order_id is not null and v_linked_order_id<>v_appt.service_order_id then
    raise exception 'O atendimento possui vínculos divergentes. Solicite a conciliação da comanda.';
  end if;
  v_linked_order_id:=coalesce(v_linked_order_id,v_appt.service_order_id);
  if v_linked_order_id is not null and p_existing_order_id is not null and p_existing_order_id<>v_linked_order_id then
    raise exception 'Este atendimento já está vinculado a outra comanda.';
  end if;
  if coalesce(v_linked_order_id,p_existing_order_id) is not null then
    select * into v_order from public.service_orders
     where org_id=v_appt.org_id and id=coalesce(v_linked_order_id,p_existing_order_id)
       and customer_id=v_appt.customer_id and branch_id is not distinct from v_appt.branch_id
       and status in ('open','in_progress','partially_paid','awaiting_payment') for update;
    if not found then raise exception 'A comanda não está aberta para este cliente e unidade.'; end if;
  end if;
  if v_order.id is null then
    insert into public.service_orders(org_id,branch_id,customer_id,appointment_id,assigned_professional_id,status,notes,created_by,created_by_type)
    values(v_appt.org_id,v_appt.branch_id,v_appt.customer_id,v_appt.id,v_appt.professional_id,'in_progress',
      v_appt.notes,v_user,case when private.has_org_role(v_appt.org_id,array['professional']) then 'professional' else 'salon' end)
    returning * into v_order;
    v_created:=true;
  else
    update public.service_orders set status=case when status in ('partially_paid','awaiting_payment') then status else 'in_progress' end,updated_at=now()
     where id=v_order.id and org_id=v_order.org_id returning * into v_order;
  end if;
  if not exists(select 1 from public.service_order_items where org_id=v_appt.org_id and source_appointment_id=v_appt.id) then
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
commit;
