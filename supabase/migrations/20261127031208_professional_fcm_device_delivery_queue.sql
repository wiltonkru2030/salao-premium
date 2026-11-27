-- FCM: dispositivo exclusivo, fila privada e entrega pelo servidor, nunca pelo navegador.
create table private.professional_push_devices(
 id uuid primary key default gen_random_uuid(), org_id uuid not null, professional_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade, token text not null unique,
 registered_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 foreign key(org_id,professional_id) references public.professionals(org_id,id) on delete cascade
);
create table private.professional_push_deliveries(
 notification_id uuid not null references private.professional_notifications(id) on delete cascade,
 device_id uuid not null references private.professional_push_devices(id) on delete cascade,
 attempts int not null default 0, lease_id uuid, lease_until timestamptz, sent_at timestamptz,
 primary key(notification_id,device_id)
);
alter table private.professional_push_devices enable row level security;
alter table private.professional_push_deliveries enable row level security;
revoke all on private.professional_push_devices,private.professional_push_deliveries from public,anon,authenticated;
create function private.set_professional_push_device(target_org uuid,device_token text,enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); prof uuid:=private.current_professional_id(target_org);
begin
 if actor is null or prof is null then raise exception 'Acesso profissional obrigatório.' using errcode='42501';end if;
 if enabled is null or device_token is null or length(device_token) not between 20 and 4096 or device_token !~ '^[A-Za-z0-9:_-]+$' then
  raise exception 'Dispositivo inválido.' using errcode='22023';
 end if;
 if enabled then
  -- Não reutiliza histórico de entregas quando o token muda de conta/salão.
  delete from private.professional_push_devices d where d.token=device_token and (d.user_id<>actor or d.org_id<>target_org or d.professional_id<>prof);
  insert into private.professional_push_devices(org_id,professional_id,user_id,token)
  values(target_org,prof,actor,device_token) on conflict(token) do update set last_seen_at=now()
  where professional_push_devices.org_id=target_org and professional_push_devices.professional_id=prof and professional_push_devices.user_id=actor;
  if not found then raise exception 'Não foi possível vincular este dispositivo.' using errcode='42501';end if;
 else
  delete from private.professional_push_devices d where d.token=device_token and d.user_id=actor and d.org_id=target_org and d.professional_id=prof;
 end if;
 return enabled;
end $$;
create function public.set_professional_push_device(target_org uuid,device_token text,enabled boolean)
returns boolean language sql security invoker set search_path='' as $$ select private.set_professional_push_device($1,$2,$3) $$;
revoke all on function private.set_professional_push_device(uuid,text,boolean),public.set_professional_push_device(uuid,text,boolean) from public,anon,authenticated;
grant execute on function private.set_professional_push_device(uuid,text,boolean),public.set_professional_push_device(uuid,text,boolean) to authenticated;

-- Somente service_role: gera lembretes mesmo com app fechado e reserva envios com lease.
create function private.claim_professional_push_deliveries()
returns table(notification_id uuid,device_id uuid,lease_id uuid,token text)
language plpgsql security definer set search_path='' as $$
declare reminder record;
begin
 for reminder in
  select distinct a.org_id,a.professional_id,a.id,a.starts_at
  from public.appointments a join private.professional_push_devices d on d.org_id=a.org_id and d.professional_id=a.professional_id
  join public.professionals p on p.org_id=d.org_id and p.id=d.professional_id and p.profile_id=d.user_id and p.active and p.access_enabled
  where a.status in ('scheduled','confirmed') and a.starts_at>now() and a.starts_at<=now()+interval '1 hour'
  and d.last_seen_at>now()-interval '30 days'
 loop
  perform private.emit_professional_notification(reminder.org_id,reminder.professional_id,'appointment_reminder','Atendimento próximo','Existe um atendimento previsto para a próxima hora. Confira sua Agenda.',reminder.id,null,'reminder:'||reminder.id::text||':'||extract(epoch from reminder.starts_at)::text);
 end loop;
 insert into private.professional_push_deliveries(notification_id,device_id)
 select n.id,d.id from private.professional_notifications n join private.professional_push_devices d on d.org_id=n.org_id and d.professional_id=n.professional_id
 where n.created_at>=d.registered_at and n.created_at>now()-interval '30 minutes' and n.read_at is null and d.last_seen_at>now()-interval '30 days'
 on conflict do nothing;
 return query
 with candidates as (
  select q.notification_id,q.device_id from private.professional_push_deliveries q
  join private.professional_notifications n on n.id=q.notification_id
  join private.professional_push_devices d on d.id=q.device_id and d.org_id=n.org_id and d.professional_id=n.professional_id
  join public.professionals p on p.org_id=d.org_id and p.id=d.professional_id and p.profile_id=d.user_id and p.active and p.access_enabled
  join public.org_memberships m on m.org_id=p.org_id and m.user_id=d.user_id and m.role='professional' and m.status='active'
  join auth.users u on u.id=d.user_id
  left join private.professional_app_preferences pref on pref.org_id=p.org_id and pref.professional_id=p.id
  where q.sent_at is null and q.attempts<3 and (q.lease_until is null or q.lease_until<now())
  and n.read_at is null and n.created_at>now()-interval '30 minutes' and d.last_seen_at>now()-interval '30 days'
  and coalesce(u.raw_app_meta_data->>'professional_password_required','false')<>'true'
  and (u.banned_until is null or u.banned_until<now())
  and case when n.kind='commission_paid' then coalesce(pref.notify_commissions,true) else coalesce(pref.notify_agenda,true) end
  order by n.created_at,q.notification_id,q.device_id limit 30 for update of q skip locked
 ), claimed as (
  update private.professional_push_deliveries q set attempts=q.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  from candidates c where q.notification_id=c.notification_id and q.device_id=c.device_id returning q.notification_id,q.device_id,q.lease_id
 )
 select c.notification_id,c.device_id,c.lease_id,d.token from claimed c join private.professional_push_devices d on d.id=c.device_id;
end $$;
create function public.claim_professional_push_deliveries()
returns table(notification_id uuid,device_id uuid,lease_id uuid,token text)
language sql security invoker set search_path='' as $$ select * from private.claim_professional_push_deliveries() $$;
create function private.finish_professional_push_delivery(target_notification uuid,target_device uuid,target_lease uuid,outcome text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if outcome is null or outcome not in ('sent','retry','invalid') then raise exception 'Resultado inválido.' using errcode='22023';end if;
 if outcome='invalid' then
  delete from private.professional_push_devices d where d.id=target_device and exists(select 1 from private.professional_push_deliveries q where q.device_id=d.id and q.notification_id=target_notification and q.lease_id=target_lease);
 else
  update private.professional_push_deliveries q set sent_at=case when outcome='sent' then now() else null end,lease_id=null,lease_until=case when outcome='retry' then now()+interval '2 minutes' else null end
  where q.notification_id=target_notification and q.device_id=target_device and q.lease_id=target_lease;
 end if;
 return found;
end $$;
create function public.finish_professional_push_delivery(target_notification uuid,target_device uuid,target_lease uuid,outcome text)
returns boolean language sql security invoker set search_path='' as $$ select private.finish_professional_push_delivery($1,$2,$3,$4) $$;
revoke all on function private.claim_professional_push_deliveries(),public.claim_professional_push_deliveries(),private.finish_professional_push_delivery(uuid,uuid,uuid,text),public.finish_professional_push_delivery(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.claim_professional_push_deliveries(),public.claim_professional_push_deliveries(),private.finish_professional_push_delivery(uuid,uuid,uuid,text),public.finish_professional_push_delivery(uuid,uuid,uuid,text) to service_role;
;
