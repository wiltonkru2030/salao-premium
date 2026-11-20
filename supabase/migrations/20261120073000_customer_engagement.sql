-- RASCUNHO — favoritos, notificações internas e preferências da identidade global.
-- Não aplicar em produção sem revisão e autorização explícita.
-- Notificações são in-app; envio push/e-mail/WhatsApp não está incluído neste rascunho.

begin;

grant usage on schema private to authenticated;

create or replace function private.is_public_salon(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.salon_public_profiles p
    join public.branch_public_profiles bp on bp.org_id=p.org_id and bp.is_published
    join public.branches b on b.org_id=bp.org_id and b.id=bp.branch_id and b.active
    where p.org_id=p_org_id and p.is_published
  );
$function$;

revoke all on function private.is_public_salon(uuid) from public,anon;
grant execute on function private.is_public_salon(uuid) to authenticated;

create table if not exists public.customer_favorites (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auth_user_id,org_id)
);

alter table public.customer_favorites enable row level security;
revoke all on public.customer_favorites from public,anon;
grant select,insert,delete on public.customer_favorites to authenticated;

drop policy if exists customer_favorites_select_own on public.customer_favorites;
create policy customer_favorites_select_own on public.customer_favorites
  for select to authenticated using (auth_user_id=(select auth.uid()));

drop policy if exists customer_favorites_insert_own_published on public.customer_favorites;
create policy customer_favorites_insert_own_published on public.customer_favorites
  for insert to authenticated with check (
    auth_user_id=(select auth.uid()) and private.is_public_salon(org_id)
  );

drop policy if exists customer_favorites_delete_own on public.customer_favorites;
create policy customer_favorites_delete_own on public.customer_favorites
  for delete to authenticated using (auth_user_id=(select auth.uid()));

drop trigger if exists audit_row_change on public.customer_favorites;
create trigger audit_row_change after insert or update or delete on public.customer_favorites
  for each row execute function private.capture_row_audit();

create or replace function private.list_my_favorite_salons()
returns table (
  org_id uuid,
  slug text,
  display_name text,
  description text,
  logo_url text,
  branch_id uuid,
  branch_name text,
  neighborhood text,
  city text,
  state char(2),
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select f.org_id,p.slug,p.display_name,p.description,p.logo_url,
         bp.branch_id,b.name,bp.neighborhood,bp.city,bp.state,f.created_at
  from public.customer_favorites f
  join public.salon_public_profiles p on p.org_id=f.org_id and p.is_published
  join public.branch_public_profiles bp on bp.org_id=f.org_id and bp.is_published
  join public.branches b on b.org_id=bp.org_id and b.id=bp.branch_id and b.active
  where f.auth_user_id=(select auth.uid())
  order by f.created_at desc,b.name;
$function$;

revoke all on function private.list_my_favorite_salons() from public,anon;
grant execute on function private.list_my_favorite_salons() to authenticated;

create or replace function public.list_my_favorite_salons()
returns table (
  org_id uuid, slug text, display_name text, description text, logo_url text,
  branch_id uuid, branch_name text, neighborhood text, city text, state char(2), created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.list_my_favorite_salons();
$function$;

revoke all on function public.list_my_favorite_salons() from public,anon,authenticated;
grant execute on function public.list_my_favorite_salons() to authenticated;

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
revoke all on public.customer_notifications from public,anon;
grant select on public.customer_notifications to authenticated;
grant update(read_at) on public.customer_notifications to authenticated;

drop policy if exists customer_notifications_select_own on public.customer_notifications;
create policy customer_notifications_select_own on public.customer_notifications
  for select to authenticated using (auth_user_id=(select auth.uid()));

drop policy if exists customer_notifications_update_own on public.customer_notifications;
create policy customer_notifications_update_own on public.customer_notifications
  for update to authenticated using (auth_user_id=(select auth.uid()))
  with check (auth_user_id=(select auth.uid()));

drop trigger if exists audit_row_change on public.customer_notifications;
create trigger audit_row_change after insert or update or delete on public.customer_notifications
  for each row execute function private.capture_row_audit();

create or replace function private.notify_customer_appointment_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_kind text;
  v_title text;
  v_body text;
  v_timezone text;
  v_when text;
begin
  select coalesce(o.timezone,'America/Sao_Paulo') into v_timezone
  from public.organizations o where o.id=new.org_id;
  v_when:=to_char(new.starts_at at time zone coalesce(v_timezone,'America/Sao_Paulo'),'DD/MM/YYYY "às" HH24:MI');

  if tg_op='INSERT' then
    v_kind:='appointment_created';
    v_title:='Solicitação de agendamento recebida';
    v_body:='Seu atendimento de '||coalesce(new.service_name,'serviço')||' foi solicitado para '||v_when||'.';
  elsif new.status is distinct from old.status then
    if new.status='confirmed' then
      v_kind:='appointment_confirmed'; v_title:='Agendamento confirmado';
      v_body:='Seu atendimento de '||coalesce(new.service_name,'serviço')||' foi confirmado para '||v_when||'.';
    elsif new.status='cancelled' then
      v_kind:='appointment_cancelled'; v_title:='Agendamento cancelado';
      v_body:='O agendamento de '||coalesce(new.service_name,'serviço')||' foi cancelado.';
    elsif new.status='completed' then
      v_kind:='appointment_completed'; v_title:='Atendimento concluído';
      v_body:='Seu atendimento de '||coalesce(new.service_name,'serviço')||' foi concluído.';
    else
      v_kind:='appointment_updated'; v_title:='Agendamento atualizado';
      v_body:='O status do seu atendimento foi atualizado.';
    end if;
  elsif new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.professional_id is distinct from old.professional_id then
    v_kind:='appointment_rescheduled';
    v_title:='Agendamento alterado';
    v_body:='Seu atendimento de '||coalesce(new.service_name,'serviço')||' foi alterado para '||v_when||'.';
  else
    return new;
  end if;

  insert into public.customer_notifications(auth_user_id,org_id,appointment_id,kind,title,body)
  select distinct link.auth_user_id,new.org_id,new.id,v_kind,v_title,v_body
  from public.customer_account_customers link
  join public.customer_tenant_memberships membership
    on membership.org_id=link.org_id
   and membership.auth_user_id=link.auth_user_id
   and membership.status='active'
  where link.org_id=new.org_id and link.customer_id=new.customer_id;

  return new;
end;
$function$;

revoke all on function private.notify_customer_appointment_changes() from public,anon,authenticated;

drop trigger if exists customer_appointment_notification_trigger on public.appointments;
create trigger customer_appointment_notification_trigger
  after insert or update of status,starts_at,ends_at,professional_id
  on public.appointments
  for each row execute function private.notify_customer_appointment_changes();

create or replace function private.get_my_customer_preferences()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(p.preferences,'{}'::jsonb)
  from public.customer_profiles p
  where p.auth_user_id=(select auth.uid());
$function$;

revoke all on function private.get_my_customer_preferences() from public,anon;
grant execute on function private.get_my_customer_preferences() to authenticated;

create or replace function public.get_my_customer_preferences()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_my_customer_preferences();
$function$;

revoke all on function public.get_my_customer_preferences() from public,anon,authenticated;
grant execute on function public.get_my_customer_preferences() to authenticated;

create or replace function private.update_my_customer_preferences(p_preferences jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_key text;
  v_next jsonb;
  v_allowed text[] := array['theme','reminders','appointmentChanges','coupons','promotions','defaultCity','defaultNeighborhood'];
begin
  if v_user is null then raise exception 'Entre na sua conta para salvar preferências.' using errcode='42501'; end if;
  if p_preferences is null or jsonb_typeof(p_preferences)<>'object' then
    raise exception 'As preferências enviadas são inválidas.' using errcode='22023';
  end if;
  for v_key in select jsonb_object_keys(p_preferences) loop
    if not (v_key=any(v_allowed)) then
      raise exception 'Uma preferência enviada não é permitida.' using errcode='22023';
    end if;
  end loop;
  if p_preferences ? 'theme' and (jsonb_typeof(p_preferences->'theme')<>'string' or p_preferences->>'theme' not in ('system','light','dark')) then
    raise exception 'Tema inválido.' using errcode='22023';
  end if;
  foreach v_key in array array['reminders','appointmentChanges','coupons','promotions'] loop
    if p_preferences ? v_key and jsonb_typeof(p_preferences->v_key)<>'boolean' then
      raise exception 'Uma preferência de notificação é inválida.' using errcode='22023';
    end if;
  end loop;
  foreach v_key in array array['defaultCity','defaultNeighborhood'] loop
    if p_preferences ? v_key and jsonb_typeof(p_preferences->v_key) not in ('string','null') then
      raise exception 'A região padrão informada é inválida.' using errcode='22023';
    end if;
    if p_preferences ? v_key and length(coalesce(p_preferences->>v_key,''))>100 then
      raise exception 'O nome da região ultrapassou o limite permitido.' using errcode='22023';
    end if;
  end loop;

  update public.customer_profiles
     set preferences=coalesce(preferences,'{}'::jsonb)||p_preferences,
         updated_at=clock_timestamp()
   where auth_user_id=v_user
   returning preferences into v_next;
  if not found then raise exception 'O perfil da cliente não foi localizado.' using errcode='P0002'; end if;
  return v_next;
end;
$function$;

revoke all on function private.update_my_customer_preferences(jsonb) from public,anon;
grant execute on function private.update_my_customer_preferences(jsonb) to authenticated;

create or replace function public.update_my_customer_preferences(p_preferences jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.update_my_customer_preferences(p_preferences);
$function$;

revoke all on function public.update_my_customer_preferences(jsonb) from public,anon,authenticated;
grant execute on function public.update_my_customer_preferences(jsonb) to authenticated;

comment on table public.customer_favorites is
  'Salões favoritos por identidade global da cliente; não pertence ao tenant.';
comment on table public.customer_notifications is
  'Notificações internas destinadas à identidade global da cliente.';
comment on function public.update_my_customer_preferences(jsonb) is
  'Atualiza somente preferências permitidas do próprio perfil global autenticado.';

commit;
