-- Tickets descartáveis: nenhum segredo permanente, token FCM ou dado pessoal passa pela fila HTTP.
create extension if not exists pg_net with schema extensions;
create table private.professional_dispatch_wake_tickets(
 ticket uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '90 seconds',
 used_at timestamptz
);
alter table private.professional_dispatch_wake_tickets enable row level security;
revoke all on private.professional_dispatch_wake_tickets from public,anon,authenticated;
-- Consome um ticket por vez; somente Edge Function privilegiada consegue chamar.
create function private.consume_professional_dispatch_wake(target_ticket uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update private.professional_dispatch_wake_tickets set used_at=clock_timestamp()
 where ticket=target_ticket and used_at is null and expires_at>clock_timestamp();
 return found;
end $$;
create function public.consume_professional_dispatch_wake(target_ticket uuid)
returns boolean language sql security invoker set search_path='' as $$select private.consume_professional_dispatch_wake($1)$$;
revoke all on function private.consume_professional_dispatch_wake(uuid),public.consume_professional_dispatch_wake(uuid) from public,anon,authenticated;
grant execute on function private.consume_professional_dispatch_wake(uuid),public.consume_professional_dispatch_wake(uuid) to service_role;
-- Executado exclusivamente pelo cron QA. Não recebe URL, destinatário ou conteúdo externo.
create function private.wake_professional_dispatch_qa()
returns boolean language plpgsql security definer set search_path='' as $$
declare v_ticket uuid;
begin
 if not pg_try_advisory_xact_lock(719836402) then return false; end if;
 delete from private.professional_dispatch_wake_tickets where expires_at<clock_timestamp()-interval '10 minutes';
 if exists(select 1 from private.professional_dispatch_wake_tickets where created_at>clock_timestamp()-interval '25 seconds') then return false; end if;
 if not exists(
 select 1 from private.professional_notifications n join private.professional_push_devices d on d.org_id=n.org_id and d.professional_id=n.professional_id
 left join private.professional_push_deliveries q on q.notification_id=n.id and q.device_id=d.id
 where n.created_at>=d.registered_at and n.created_at>now()-interval '30 minutes' and n.read_at is null and d.last_seen_at>now()-interval '30 days'
 and (q.notification_id is null or(q.sent_at is null and q.attempts<3 and (q.lease_until is null or q.lease_until<now())))
 ) and not exists(
 select 1 from public.appointments a join private.professional_push_devices d on d.org_id=a.org_id and d.professional_id=a.professional_id
 where a.status in ('scheduled','confirmed') and a.starts_at>now() and a.starts_at<=now()+interval '1 hour'
 and d.last_seen_at>now()-interval '30 days'
 and not exists(select 1 from private.professional_notifications n where n.org_id=a.org_id and n.professional_id=a.professional_id and n.dedupe_key='reminder:'||a.id::text||':'||extract(epoch from a.starts_at)::text)
 ) then return false; end if;
 insert into private.professional_dispatch_wake_tickets default values returning ticket into v_ticket;
 perform net.http_post(url:='https://eaiutjqvyesboldcznyr.supabase.co/functions/v1/dispatch-professional-push',body:=jsonb_build_object('mode','send','wake_ticket',v_ticket),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=30000);
 return true;
end $$;
revoke all on function private.wake_professional_dispatch_qa() from public,anon,authenticated,service_role;
