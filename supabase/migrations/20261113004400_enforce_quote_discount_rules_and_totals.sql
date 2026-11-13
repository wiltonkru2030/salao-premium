-- Regras de desconto e totalização são validadas no banco, não apenas na interface.
create or replace function public.validate_quote_item()
returns trigger language plpgsql set search_path = ''
as $$
declare v_max numeric(5,2); v_allowed boolean; v_quote_org uuid; v_base numeric(12,2);
begin
  select q.org_id into v_quote_org from public.quotes q where q.id = new.quote_id;
  if v_quote_org is null or v_quote_org <> new.org_id then raise exception 'Orçamento e item devem pertencer à mesma organização.'; end if;
  if not exists(select 1 from public.services s where s.id=new.service_id and s.org_id=new.org_id and s.active) then raise exception 'Serviço inválido para esta organização.'; end if;
  if new.professional_id is not null and not exists(select 1 from public.professionals p where p.id=new.professional_id and p.org_id=new.org_id and p.active) then raise exception 'Profissional inválido para esta organização.'; end if;
  select coalesce(qs.max_discount_percent,0) into v_max from public.quote_settings qs where qs.org_id=new.org_id;
  v_max := coalesce(v_max,0); v_base := new.quantity * new.unit_price;
  if new.discount_amount > 0 then
    select exists(select 1 from public.quote_discount_services r where r.org_id=new.org_id and r.service_id=new.service_id and r.discount_allowed) into v_allowed;
    if not coalesce(v_allowed,false) then raise exception 'Este serviço não permite desconto.'; end if;
    if v_base <= 0 or (new.discount_amount / v_base * 100) > v_max then raise exception 'Desconto acima do limite configurado para o salão.'; end if;
  end if;
  return new;
end; $$;
create or replace function public.recalculate_quote_totals()
returns trigger language plpgsql set search_path = ''
as $$
declare v_quote_id uuid;
begin
  v_quote_id := coalesce(new.quote_id,old.quote_id);
  update public.quotes q set
    subtotal=coalesce((select sum(i.quantity*i.unit_price) from public.quote_items i where i.quote_id=v_quote_id and i.org_id=q.org_id),0),
    discount_total=coalesce((select sum(i.discount_amount) from public.quote_items i where i.quote_id=v_quote_id and i.org_id=q.org_id),0),
    total=coalesce((select sum(i.total) from public.quote_items i where i.quote_id=v_quote_id and i.org_id=q.org_id),0),
    updated_at=now() where q.id=v_quote_id;
  return coalesce(new,old);
end; $$;
drop trigger if exists quote_items_validate_before_write on public.quote_items;
create trigger quote_items_validate_before_write before insert or update on public.quote_items for each row execute function public.validate_quote_item();
drop trigger if exists quote_items_recalculate_after_write on public.quote_items;
create trigger quote_items_recalculate_after_write after insert or update or delete on public.quote_items for each row execute function public.recalculate_quote_totals();
revoke all on function public.validate_quote_item() from public, anon;
revoke all on function public.recalculate_quote_totals() from public, anon;
