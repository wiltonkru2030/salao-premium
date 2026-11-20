-- 20261119170000_snapshot_commission_rate_on_first_payment
-- Congela elegibilidade e percentual de comissão por item no primeiro recebimento confirmado.
-- Não reescreve lançamentos históricos: somente itens ainda sem snapshot recebem os novos campos.

alter table public.service_order_items
  add column if not exists commission_rate_snapshot numeric(7,4),
  add column if not exists commission_enabled_snapshot boolean;

comment on column public.service_order_items.commission_rate_snapshot is
  'Percentual de comissão congelado no primeiro pagamento confirmado da comanda; NULL indica item ainda não snapshotado.';
comment on column public.service_order_items.commission_enabled_snapshot is
  'Indica se o item era elegível a comissão no primeiro pagamento confirmado; preserva inclusive produto com comissão desabilitada.';

create or replace function private.snapshot_service_order_item_commissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item record;
  v_rate numeric;
  v_enabled boolean;
  v_default_product_rate numeric;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  for v_item in
    select i.*
      from public.service_order_items i
     where i.org_id = new.org_id
       and i.order_id = new.order_id
       and i.commission_enabled_snapshot is null
     order by i.created_at, i.id
     for update
  loop
    v_rate := 0;
    v_enabled := false;

    if v_item.professional_id is not null and v_item.item_type = 'service' then
      select cr.rate into v_rate
        from public.commission_rules cr
       where cr.org_id = v_item.org_id
         and cr.active = true
         and cr.item_type = 'service'
         and cr.product_id is null
         and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
         and (cr.service_id = v_item.service_id or cr.service_id is null)
       order by (cr.professional_id is not null) desc,
                (cr.service_id is not null) desc
       limit 1;

      if v_rate is null then
        select p.commission_rate into v_rate
          from public.professionals p
         where p.org_id = v_item.org_id and p.id = v_item.professional_id;
      end if;
      v_enabled := true;

    elsif v_item.professional_id is not null and v_item.item_type = 'product' then
      v_enabled := false;
      v_default_product_rate := null;

      select coalesce((s.setting_value->>'enabled')::boolean, false),
             nullif(s.setting_value->>'default_rate', '')::numeric
        into v_enabled, v_default_product_rate
        from public.app_settings s
       where s.org_id = v_item.org_id
         and s.setting_key = 'product_commission'
         and (s.branch_id is null or s.branch_id is not distinct from (
           select o.branch_id from public.service_orders o
            where o.org_id = new.org_id and o.id = new.order_id
         ))
       order by (s.branch_id is not null) desc
       limit 1;

      if coalesce(v_enabled, false) then
        v_rate := null;
        select cr.rate into v_rate
          from public.commission_rules cr
         where cr.org_id = v_item.org_id
           and cr.active = true
           and cr.item_type = 'product'
           and cr.service_id is null
           and (cr.professional_id = v_item.professional_id or cr.professional_id is null)
           and (cr.product_id = v_item.product_id or cr.product_id is null)
         order by (cr.professional_id is not null) desc,
                  (cr.product_id is not null) desc
         limit 1;

        if v_rate is null then
          select coalesce(v_default_product_rate, p.commission_rate) into v_rate
            from public.professionals p
           where p.org_id = v_item.org_id and p.id = v_item.professional_id;
        end if;
      else
        v_rate := 0;
      end if;
    end if;

    update public.service_order_items
       set commission_rate_snapshot = coalesce(v_rate, 0),
           commission_enabled_snapshot = coalesce(v_enabled, false)
     where org_id = v_item.org_id and id = v_item.id
       and commission_enabled_snapshot is null;
  end loop;

  return new;
end;
$function$;

create or replace function private.enforce_commission_item_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_snapshot record;
begin
  if new.service_order_item_id is null then
    return new;
  end if;

  select i.commission_rate_snapshot, i.commission_enabled_snapshot
    into v_snapshot
    from public.service_order_items i
   where i.org_id = new.org_id and i.id = new.service_order_item_id;

  if not found or v_snapshot.commission_enabled_snapshot is null then
    return new;
  end if;

  if not v_snapshot.commission_enabled_snapshot then
    return null;
  end if;

  new.rate := coalesce(v_snapshot.commission_rate_snapshot, 0);
  new.amount := round(coalesce(new.base_amount, 0) * new.rate / 100, 2);
  return new;
end;
$function$;

revoke all on function private.snapshot_service_order_item_commissions() from public, anon, authenticated;
revoke all on function private.enforce_commission_item_snapshot() from public, anon, authenticated;

drop trigger if exists snapshot_service_order_commissions_after_payment on public.service_order_payments;
create trigger snapshot_service_order_commissions_after_payment
after insert on public.service_order_payments
for each row execute function private.snapshot_service_order_item_commissions();

drop trigger if exists enforce_commission_item_snapshot_before_insert on public.commissions;
create trigger enforce_commission_item_snapshot_before_insert
before insert on public.commissions
for each row execute function private.enforce_commission_item_snapshot();
