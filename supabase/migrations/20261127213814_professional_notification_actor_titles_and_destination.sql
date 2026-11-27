-- Notificações de agenda por autor autenticado, sem nomes ou outros dados pessoais na tela bloqueada.
create or replace function private.professional_appointment_event_title(event_kind text, actor_kind text)
returns text language sql immutable set search_path='' as $$
 select case actor_kind
 when 'customer' then case event_kind when 'appointment_created' then 'Cliente agendou' when 'appointment_cancelled' then 'Cliente cancelou' when 'appointment_confirmed' then 'Cliente confirmou' when 'appointment_rescheduled' then 'Cliente reagendou' end
 when 'salon' then case event_kind when 'appointment_created' then 'Salão agendou' when 'appointment_cancelled' then 'Salão cancelou' when 'appointment_confirmed' then 'Salão confirmou' when 'appointment_rescheduled' then 'Salão reagendou' end
 when 'professional' then case event_kind when 'appointment_created' then 'Profissional agendou' when 'appointment_cancelled' then 'Profissional cancelou' when 'appointment_confirmed' then 'Profissional confirmou' when 'appointment_rescheduled' then 'Profissional reagendou' end
 end
$$;
revoke all on function private.professional_appointment_event_title(text,text) from public,anon,authenticated;
-- Origem do evento atual: não usar booking_source para atribuir alterações posteriores.
create or replace function private.notify_professional_appointment_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare k text; t text; actor uuid:=auth.uid(); actor_kind text; staff_role text; is_customer boolean:=false;
begin
 if tg_op='INSERT' then
  if new.status in ('cancelled','completed','no_show') then return new; end if;
  k:='appointment_created';t:='Novo agendamento';
 elsif new.professional_id is distinct from old.professional_id then
  perform private.emit_professional_notification(old.org_id,old.professional_id,'appointment_reassigned','Agendamento transferido','Um atendimento deixou de estar vinculado à sua agenda.',old.id,null,null);
  k:='appointment_assigned';t:='Novo atendimento atribuído';
 elsif new.status='cancelled' and old.status is distinct from new.status then
  k:='appointment_cancelled';t:='Agendamento cancelado';
 elsif new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.branch_id is distinct from old.branch_id then
  k:='appointment_rescheduled';t:='Agendamento alterado';
 elsif new.status='confirmed' and old.status is distinct from new.status then
  k:='appointment_confirmed';t:='Agendamento confirmado';
 else return new;
 end if;
 if actor is not null then
  select case when count(distinct m.role)=1 then min(m.role) end into staff_role
  from public.org_memberships m where m.org_id=new.org_id and m.user_id=actor and m.status='active';
  select exists(select 1 from public.customer_account_customers c where c.org_id=new.org_id and c.auth_user_id=actor and c.customer_id=new.customer_id) into is_customer;
  -- A identidade ambígua usa aviso neutro; não atribui a ação a pessoa errada.
  if staff_role is null and is_customer then actor_kind:='customer';
  elsif not is_customer and staff_role='professional' then actor_kind:='professional';
  elsif not is_customer and staff_role in ('owner','admin','manager','receptionist','finance') then actor_kind:='salon';
  end if;
  if tg_op='INSERT' and actor_kind is distinct from new.booking_source then actor_kind:=null;end if;
 end if;
 t:=coalesce(private.professional_appointment_event_title(k,actor_kind),t);
 perform private.emit_professional_notification(new.org_id,new.professional_id,k,t,'Abra o aplicativo para conferir os detalhes do atendimento.',new.id,null,null);
 return new;
end $$;
-- Acesso direto ao aviso próprio: não depende do limite de 100 da central.
create or replace function private.get_professional_notification(target_org uuid,target_notification uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); result jsonb;
begin
 if auth.uid() is null or prof is null then raise exception 'Notificações não autorizadas.' using errcode='42501';end if;
 select jsonb_build_object('id',n.id,'appointment_id',n.appointment_id,'payout_id',n.payout_id,'kind',n.kind)
 into result from private.professional_notifications n where n.org_id=target_org and n.professional_id=prof and n.id=target_notification;
 return result;
end $$;
create or replace function public.get_professional_notification(target_org uuid,target_notification uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_professional_notification($1,$2) $$;
revoke all on function private.get_professional_notification(uuid,uuid),public.get_professional_notification(uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_professional_notification(uuid,uuid),public.get_professional_notification(uuid,uuid) to authenticated;
-- Transporte recebe apenas título da lista permitida, vinculado ao lease do envio.
create or replace function private.get_professional_push_title(target_notification uuid,target_device uuid,target_lease uuid)
returns text language sql security definer set search_path='' as $$
 select case when n.title in ('Cliente agendou','Cliente cancelou','Cliente confirmou','Cliente reagendou','Salão agendou','Salão cancelou','Salão confirmou','Salão reagendou','Profissional agendou','Profissional cancelou','Profissional confirmou','Profissional reagendou','Novo agendamento','Agendamento cancelado','Agendamento confirmado','Agendamento alterado','Agendamento transferido','Novo atendimento atribuído','Atendimento próximo','Pagamento de comissão registrado') then n.title else 'SALÃO PREMIUM' end
 from private.professional_push_deliveries d join private.professional_notifications n on n.id=d.notification_id
 where d.notification_id=target_notification and d.device_id=target_device and d.lease_id=target_lease and d.lease_until>now() and d.sent_at is null
$$;
create or replace function public.get_professional_push_title(target_notification uuid,target_device uuid,target_lease uuid)
returns text language sql security invoker set search_path='' as $$ select private.get_professional_push_title($1,$2,$3) $$;
revoke all on function private.get_professional_push_title(uuid,uuid,uuid),public.get_professional_push_title(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_professional_push_title(uuid,uuid,uuid),public.get_professional_push_title(uuid,uuid,uuid) to service_role;
