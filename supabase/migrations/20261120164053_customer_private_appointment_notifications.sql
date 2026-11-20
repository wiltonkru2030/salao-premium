-- Central interna: mensagens operacionais privadas, sem envio externo.
create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_notifications_kind check (
    kind in ('appointment_created','appointment_confirmed','appointment_cancelled','appointment_completed','appointment_rescheduled','appointment_updated')
  ),
  constraint customer_notifications_title_length check (length(title) between 1 and 120),
  constraint customer_notifications_body_length check (length(body) between 1 and 500)
);

create index if not exists customer_notifications_owner_created_idx
  on public.customer_notifications(auth_user_id,created_at desc);

alter table public.customer_notifications enable row level security;
revoke all on public.customer_notifications from public,anon,authenticated;
grant select on public.customer_notifications to authenticated;
grant update(read_at) on public.customer_notifications to authenticated;

drop policy if exists customer_notifications_select_own on public.customer_notifications;
create policy customer_notifications_select_own on public.customer_notifications
  for select to authenticated using (auth_user_id=(select auth.uid()));

drop policy if exists customer_notifications_update_own on public.customer_notifications;
create policy customer_notifications_update_own on public.customer_notifications
  for update to authenticated using (auth_user_id=(select auth.uid()))
  with check (auth_user_id=(select auth.uid()));

-- Notificações e leitura permanecem privadas; não replicar o conteúdo em auditoria administrativa.


create index if not exists customer_notifications_org_idx on public.customer_notifications(org_id);
create index if not exists customer_notifications_appointment_idx on public.customer_notifications(appointment_id);
-- Um evento por mudança relevante; sem dependência de fuso ou texto livre.
CREATE OR REPLACE FUNCTION private.notify_customer_appointment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_kind text; v_title text; v_body text;
begin
 if tg_op='INSERT' then
  v_kind:='appointment_created';v_title:='Agendamento registrado';v_body:='Seu horário foi registrado. Consulte os detalhes em Agendamentos.';
 elsif new.status is distinct from old.status then
  case new.status
   when 'confirmed' then v_kind:='appointment_confirmed';v_title:='Agendamento confirmado';v_body:='O salão confirmou seu horário.';
   when 'cancelled' then v_kind:='appointment_cancelled';v_title:='Agendamento cancelado';v_body:='Seu horário foi cancelado.';
   when 'completed' then v_kind:='appointment_completed';v_title:='Atendimento concluído';v_body:='Seu atendimento foi concluído.';
   else v_kind:='appointment_updated';v_title:='Agendamento atualizado';v_body:='Consulte o novo status em Agendamentos.';
  end case;
 elsif new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.professional_id is distinct from old.professional_id or new.branch_id is distinct from old.branch_id then
  v_kind:='appointment_rescheduled';v_title:='Agendamento alterado';v_body:='Consulte a data, unidade e profissional atualizados em Agendamentos.';
 else return new;
 end if;
 insert into public.customer_notifications(auth_user_id,org_id,appointment_id,kind,title,body)
 select link.auth_user_id,new.org_id,new.id,v_kind,v_title,v_body
 from public.customer_account_customers link
 join public.customer_tenant_memberships m on m.org_id=link.org_id and m.auth_user_id=link.auth_user_id and m.status='active'
 where link.org_id=new.org_id and link.customer_id=new.customer_id;
 return new;
end;
$function$;
revoke all on function private.notify_customer_appointment_changes() from public,anon,authenticated;
drop trigger if exists customer_appointment_notification_trigger on public.appointments;
create trigger customer_appointment_notification_trigger
 after insert or update of status,starts_at,ends_at,professional_id,branch_id on public.appointments
 for each row execute function private.notify_customer_appointment_changes();
comment on table public.customer_notifications is 'Avisos operacionais internos e privados de cada identidade; não envia push nem mensagens externas.';
