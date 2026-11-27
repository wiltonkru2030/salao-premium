-- Central individual de notificações: eventos persistidos sem dados de clientes ou valores financeiros.
create table private.professional_notifications(
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 professional_id uuid not null,
 kind text not null,
 title text not null,
 body text not null,
 appointment_id uuid,
 payout_id uuid,
 dedupe_key text,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz,
 foreign key(org_id,professional_id) references public.professionals(org_id,id) on delete cascade,
 unique(org_id,professional_id,dedupe_key)
);
alter table private.professional_notifications enable row level security;
revoke all on private.professional_notifications from public,anon,authenticated;
create index professional_notifications_inbox_idx on private.professional_notifications(org_id,professional_id,created_at desc,id desc);
create index professional_notifications_unread_idx on private.professional_notifications(org_id,professional_id) where read_at is null;

-- Emite avisos apenas para profissionais ativos com acesso e preferência correspondente.
create or replace function private.emit_professional_notification(target_org uuid,target_professional uuid,event_kind text,event_title text,event_body text,event_appointment uuid,event_payout uuid,event_key text default null)
returns void language sql security definer set search_path='' as $$
 insert into private.professional_notifications(org_id,professional_id,kind,title,body,appointment_id,payout_id,dedupe_key)
 select p.org_id,p.id,event_kind,event_title,event_body,event_appointment,event_payout,event_key
 from public.professionals p
 join public.org_memberships m on m.org_id=p.org_id and m.user_id=p.profile_id and m.status='active' and m.role='professional'
 left join private.professional_app_preferences pref on pref.org_id=p.org_id and pref.professional_id=p.id
 where p.org_id=target_org and p.id=target_professional and p.active and p.access_enabled
 and case when event_kind='commission_paid' then coalesce(pref.notify_commissions,true) else coalesce(pref.notify_agenda,true) end
 on conflict(org_id,professional_id,dedupe_key) do nothing
$$;
revoke all on function private.emit_professional_notification(uuid,uuid,text,text,text,uuid,uuid,text) from public,anon,authenticated;

-- Criação, mudança de profissional, horário, confirmação e cancelamento.
create or replace function private.notify_professional_appointment_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare k text; t text;
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
 perform private.emit_professional_notification(new.org_id,new.professional_id,k,t,'Consulte sua Agenda para verificar os detalhes atualizados.',new.id,null,null);
 return new;
end $$;
revoke all on function private.notify_professional_appointment_changes() from public,anon,authenticated;
create trigger professional_appointment_notification_trigger after insert or update of status,starts_at,ends_at,professional_id,branch_id on public.appointments
for each row execute function private.notify_professional_appointment_changes();

-- O pagamento efetivo gera um único aviso; nenhuma comissão é calculada por este trigger.
create or replace function private.notify_professional_commission_payout()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.emit_professional_notification(new.org_id,new.professional_id,'commission_paid','Pagamento de comissão registrado','Consulte o registro do repasse em Comissões.',null,new.id,'payout:'||new.id::text);
 return new;
end $$;
revoke all on function private.notify_professional_commission_payout() from public,anon,authenticated;
create trigger professional_payout_notification_trigger after insert on public.commission_payouts for each row execute function private.notify_professional_commission_payout();

-- Lembretes sob demanda da central (não são agendamento em segundo plano).
create or replace function private.get_professional_notifications(target_org uuid,only_unread boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); a record; result jsonb;
begin
 if auth.uid() is null or prof is null then raise exception 'Notificações não autorizadas.' using errcode='42501'; end if;
 for a in select x.id,x.starts_at from public.appointments x where x.org_id=target_org and x.professional_id=prof
  and x.status in ('scheduled','confirmed') and x.starts_at>now() and x.starts_at<=now()+interval '1 hour' loop
  perform private.emit_professional_notification(target_org,prof,'appointment_reminder','Atendimento próximo','Existe um atendimento previsto para a próxima hora. Confira sua Agenda.',a.id,null,'reminder:'||a.id::text||':'||extract(epoch from a.starts_at)::text);
 end loop;
 select jsonb_build_object('unread_count',(select count(*) from private.professional_notifications n where n.org_id=target_org and n.professional_id=prof and n.read_at is null),
 'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from
 (select n.id,n.kind,n.title,n.body,n.appointment_id,n.payout_id,n.created_at,n.read_at from private.professional_notifications n
 where n.org_id=target_org and n.professional_id=prof and (not coalesce(only_unread,false) or n.read_at is null) order by n.created_at desc,n.id desc limit 100) x),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function private.mark_professional_notifications_read(target_org uuid,target_notification uuid default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); affected bigint;
begin
 if auth.uid() is null or prof is null then raise exception 'Notificações não autorizadas.' using errcode='42501'; end if;
 update private.professional_notifications n set read_at=clock_timestamp() where n.org_id=target_org and n.professional_id=prof and n.read_at is null and (target_notification is null or n.id=target_notification);
 get diagnostics affected=row_count;
 return affected;
end $$;
create or replace function public.get_professional_notifications(target_org uuid,only_unread boolean default false)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_professional_notifications($1,$2) $$;
create or replace function public.mark_professional_notifications_read(target_org uuid,target_notification uuid default null)
returns bigint language sql security invoker set search_path='' as $$ select private.mark_professional_notifications_read($1,$2) $$;
revoke all on function private.get_professional_notifications(uuid,boolean),public.get_professional_notifications(uuid,boolean),private.mark_professional_notifications_read(uuid,uuid),public.mark_professional_notifications_read(uuid,uuid) from public,anon;
grant execute on function private.get_professional_notifications(uuid,boolean),public.get_professional_notifications(uuid,boolean),private.mark_professional_notifications_read(uuid,uuid),public.mark_professional_notifications_read(uuid,uuid) to authenticated;
