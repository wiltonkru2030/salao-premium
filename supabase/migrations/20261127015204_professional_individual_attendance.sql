-- Fluxo individual Agenda -> Comanda -> Caixa. Reutiliza o contrato do painel.
-- Não recebe valores, pagamentos ou identificadores de profissionais do navegador.
create or replace function private.professional_attendance_action(target_org uuid,target_appointment uuid,operation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 prof uuid:=private.current_professional_id(target_org);
 unit uuid:=private.professional_customer_branch(target_org);
 a public.appointments%rowtype;
 o public.service_orders%rowtype;
 opened jsonb;
begin
 if auth.uid() is null or prof is null or unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 select * into a from public.appointments x where x.org_id=target_org and x.id=target_appointment and x.professional_id=prof and x.branch_id=unit for update;
 if not found then raise exception 'Atendimento não autorizado.' using errcode='42501'; end if;
 if a.appointment_group_id is not null then raise exception 'Atendimento agrupado: consulte a recepção.' using errcode='23514'; end if;
 if operation is null or operation not in ('start','finish') then raise exception 'Operação inválida.' using errcode='22023'; end if;
 if a.service_order_id is not null then
  select * into o from public.service_orders x where x.org_id=target_org and x.id=a.service_order_id and x.branch_id=unit and x.assigned_professional_id=prof and x.appointment_id=a.id and x.customer_id is not distinct from a.customer_id for update;
  if not found then raise exception 'Comanda compartilhada ou indisponível.' using errcode='42501'; end if;
  if exists(select 1 from public.appointments x where x.org_id=target_org and x.service_order_id=o.id and x.id<>a.id)
   or exists(select 1 from public.service_order_items i where i.org_id=target_org and i.order_id=o.id and i.professional_id is distinct from prof) then
    raise exception 'Comanda compartilhada: consulte a recepção.' using errcode='23514';
  end if;
  -- Repetição do pedido não recria comanda ou item.
  if operation='start' and a.status='in_progress' and o.status='in_progress' then
   return jsonb_build_object('id',a.id,'status',a.status,'order_id',o.id,'order_status',o.status);
  end if;
  if operation='finish' and a.status='completed' and o.status in ('awaiting_payment','partially_paid','closed') then
   return jsonb_build_object('id',a.id,'status',a.status,'order_id',o.id,'order_status',o.status);
  end if;
 end if;
 if operation='start' then
  if a.status not in ('scheduled','confirmed','arrived') or a.service_order_id is not null or a.service_id is null or a.customer_id is null then raise exception 'Agendamento indisponível para início.' using errcode='23514'; end if;
  -- O trigger legado usa preço atual; divergência requer revisão para não cobrar diferente do agendado.
  if not exists(select 1 from public.services s join public.professional_services l on l.org_id=s.org_id and l.service_id=s.id and l.professional_id=prof where s.org_id=target_org and s.id=a.service_id and s.active and s.archived_at is null and (s.branch_id=unit or s.branch_id is null) and s.price=a.price) then raise exception 'Confira o serviço e o preço com a recepção.' using errcode='23514'; end if;
  if exists(select 1 from public.service_order_items i where i.org_id=target_org and i.source_appointment_id=a.id) then raise exception 'Já existe lançamento para este atendimento.' using errcode='23514'; end if;
  opened:=private.start_appointment_service_order(a.id,null,false);
  return jsonb_build_object('id',a.id,'status','in_progress','order_id',opened->>'order_id','order_status',opened->>'status');
 end if;
 if a.status<>'in_progress' or o.id is null or o.status not in ('open','in_progress') then raise exception 'Atendimento indisponível para conclusão.' using errcode='23514'; end if;
 if exists(select 1 from public.service_order_payments p where p.org_id=target_org and p.order_id=o.id) then raise exception 'Comanda com movimentação: consulte o Caixa.' using errcode='23514'; end if;
 if not exists(select 1 from public.service_order_items i where i.org_id=target_org and i.order_id=o.id and i.source_appointment_id=a.id and i.professional_id=prof) then raise exception 'Serviço do atendimento não encontrado.' using errcode='23514'; end if;
 update public.service_orders set status='awaiting_payment',updated_at=now() where org_id=target_org and id=o.id;
 update public.appointments set status='completed',updated_at=now() where org_id=target_org and id=a.id;
 return jsonb_build_object('id',a.id,'status','completed','order_id',o.id,'order_status','awaiting_payment');
end $$;

create or replace function public.professional_attendance_action(target_org uuid,target_appointment uuid,operation text)
returns jsonb language sql security invoker set search_path='' as $$ select private.professional_attendance_action($1,$2,$3) $$;
revoke all on function private.professional_attendance_action(uuid,uuid,text),public.professional_attendance_action(uuid,uuid,text) from public,anon;
grant execute on function private.professional_attendance_action(uuid,uuid,text),public.professional_attendance_action(uuid,uuid,text) to authenticated;
