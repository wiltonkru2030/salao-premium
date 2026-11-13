alter table public.quote_items
  add column if not exists discount_mode text not null default 'percent'
  check (discount_mode in ('percent','fixed'));
create or replace function public.validate_quote_item()
returns trigger language plpgsql set search_path = ''
as $$
declare v_max numeric(5,2); v_allowed boolean; v_fixed_allowed boolean; v_quote_org uuid; v_base numeric(12,2);
begin
  select q.org_id into v_quote_org from public.quotes q where q.id=new.quote_id;
  if v_quote_org is null or v_quote_org<>new.org_id then raise exception 'Orçamento e item devem pertencer à mesma organização.'; end if;
  if not exists(select 1 from public.services s where s.id=new.service_id and s.org_id=new.org_id and s.active) then raise exception 'Serviço inválido para esta organização.'; end if;
  if new.professional_id is not null and not exists(select 1 from public.professionals p where p.id=new.professional_id and p.org_id=new.org_id and p.active) then raise exception 'Profissional inválido para esta organização.'; end if;
  select coalesce(qs.max_discount_percent,0),coalesce(qs.allow_fixed_discount,true) into v_max,v_fixed_allowed from public.quote_settings qs where qs.org_id=new.org_id;
  v_max:=coalesce(v_max,0); v_fixed_allowed:=coalesce(v_fixed_allowed,true); v_base:=new.quantity*new.unit_price;
  if new.discount_amount>0 then
    select exists(select 1 from public.quote_discount_services r where r.org_id=new.org_id and r.service_id=new.service_id and r.discount_allowed) into v_allowed;
    if not coalesce(v_allowed,false) then raise exception 'Este serviço não permite desconto.'; end if;
    if new.discount_mode='fixed' and not v_fixed_allowed then raise exception 'O salão não permite desconto em valor fixo.'; end if;
    if v_base<=0 or (new.discount_amount/v_base*100)>v_max then raise exception 'Desconto acima do limite configurado para o salão.'; end if;
  end if;
  return new;
end; $$;
