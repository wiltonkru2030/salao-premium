-- Fix grouped Comanda lookup: PostgreSQL does not define min(uuid).
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
