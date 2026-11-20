
-- Avoid recursive side effects and protect settled payments from silent cancellation.
create or replace function private.sync_appointment_comanda_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='cancelled' and old.status is distinct from new.status then
    new.cancelled_at:=coalesce(new.cancelled_at,clock_timestamp());
    if new.service_order_id is not null then
      if exists(
        select 1 from public.service_order_payments p
        where p.org_id=new.org_id and p.order_id=new.service_order_id and p.status='confirmed'
      ) then
        raise exception 'Esta comanda já recebeu pagamento. Registre o estorno antes de cancelar o horário.';
      end if;
      if not exists(
        select 1 from public.appointments other
        where other.org_id=new.org_id and other.service_order_id=new.service_order_id
          and other.id<>new.id and other.status not in ('cancelled','completed')
      ) then
        perform set_config('app.skip_comanda_appointment_sync','1',true);
        update public.service_orders
           set status='cancelled',updated_at=clock_timestamp()
         where id=new.service_order_id and org_id=new.org_id and status not in ('cancelled','closed');
        perform set_config('app.skip_comanda_appointment_sync','0',true);
      end if;
    end if;
  elsif new.status='completed' and old.status is distinct from new.status then
    new.completed_at:=coalesce(new.completed_at,clock_timestamp());
  end if;
  return new;
end;
$$;

create or replace function private.sync_comanda_appointment_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='cancelled' and old.status is distinct from new.status
     and coalesce(current_setting('app.skip_comanda_appointment_sync',true),'0')<>'1' then
    if exists(
      select 1 from public.service_order_payments p
      where p.org_id=new.org_id and p.order_id=new.id and p.status='confirmed'
    ) then
      raise exception 'Esta comanda já recebeu pagamento. Registre o estorno antes de cancelar.';
    end if;
    update public.appointments
       set status='cancelled',cancelled_at=coalesce(cancelled_at,clock_timestamp()),updated_at=clock_timestamp()
     where org_id=new.org_id and service_order_id=new.id
       and status not in ('cancelled','completed');
  end if;
  return new;
end;
$$;

create or replace function private.unlink_order_before_appointment_delete()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.service_order_id is not null then
    if exists(
      select 1 from public.service_order_payments p
      where p.org_id=old.org_id and p.order_id=old.service_order_id and p.status='confirmed'
    ) then
      raise exception 'Este agendamento possui comanda com pagamento. Faça o estorno antes de excluir.';
    end if;
    if not exists(
      select 1 from public.appointments other
      where other.org_id=old.org_id and other.service_order_id=old.service_order_id
        and other.id<>old.id and other.status not in ('cancelled','completed')
    ) then
      perform set_config('app.skip_comanda_appointment_sync','1',true);
      update public.service_orders
         set status=case when status not in ('closed','cancelled') then 'cancelled' else status end,
             appointment_id=null,updated_at=clock_timestamp()
       where org_id=old.org_id and id=old.service_order_id;
      perform set_config('app.skip_comanda_appointment_sync','0',true);
    else
      update public.service_orders set appointment_id=null,updated_at=clock_timestamp()
       where org_id=old.org_id and appointment_id=old.id;
    end if;
  else
    update public.service_orders set appointment_id=null,updated_at=clock_timestamp()
     where org_id=old.org_id and appointment_id=old.id;
  end if;
  return old;
end;
$$;

create or replace function private.recalculate_service_order_totals()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare target_org uuid; target_order uuid; item_total numeric;
begin
  if tg_op='DELETE' then target_org:=old.org_id;target_order:=old.order_id;
  else target_org:=new.org_id;target_order:=new.order_id; end if;
  select coalesce(sum(i.total),0) into item_total
    from public.service_order_items i
   where i.org_id=target_org and i.order_id=target_order;
  update public.service_orders o
     set subtotal=item_total,total=greatest(item_total-o.discount,0),updated_at=clock_timestamp()
   where o.org_id=target_org and o.id=target_order;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.recalculate_service_order_totals() from public,anon,authenticated;

-- Consolidate the two profile read policies into one scoped policy.
drop policy if exists profiles_select_org_admin on public.profiles;
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self_or_org_admin
on public.profiles for select to authenticated
using (
  id=(select auth.uid())
  or exists(
    select 1 from public.org_memberships target
    where target.user_id=profiles.id and target.status='active'
      and private.has_org_role(target.org_id,array['owner','admin','manager'])
  )
);

-- Keep only one copy of the repeated calendar/commission lookup indexes.
drop index if exists public.appointments_org_starts_at_idx;
drop index if exists public.appointments_professional_starts_at_idx;
drop index if exists public.service_order_items_professional_idx;

-- Payment foreign-key indexes for the new payment ledger.
create index if not exists service_order_payments_order_id_idx on public.service_order_payments(order_id);
create index if not exists service_order_payments_branch_id_idx on public.service_order_payments(branch_id);
create index if not exists service_order_payments_cash_register_id_idx on public.service_order_payments(cash_register_id);
create index if not exists service_order_payments_cash_movement_id_idx on public.service_order_payments(cash_movement_id);
