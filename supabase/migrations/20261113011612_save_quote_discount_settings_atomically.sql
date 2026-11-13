-- Salva todas as regras de desconto do tenant em uma única transação.
CREATE OR REPLACE FUNCTION public.save_quote_discount_settings(p_org_id uuid, p_max_discount_percent numeric, p_allow_fixed_discount boolean, p_service_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager']) then
    raise exception 'Somente a administração pode alterar as regras de desconto.';
  end if;
  if p_max_discount_percent is null or p_max_discount_percent<0 or p_max_discount_percent>100 then
    raise exception 'Informe um limite de desconto entre 0 e 100 por cento.';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_service_ids,'{}'::uuid[])) requested(service_id)
    where not exists(select 1 from public.services s where s.id=requested.service_id and s.org_id=p_org_id and s.active)
  ) then raise exception 'Uma das opções selecionadas não pertence aos serviços ativos desta organização.'; end if;

  insert into public.quote_settings(org_id,max_discount_percent,allow_fixed_discount,updated_by)
  values(p_org_id,p_max_discount_percent,coalesce(p_allow_fixed_discount,true),v_user)
  on conflict(org_id) do update set
    max_discount_percent=excluded.max_discount_percent,
    allow_fixed_discount=excluded.allow_fixed_discount,
    updated_by=excluded.updated_by,
    updated_at=clock_timestamp();

  delete from public.quote_discount_services where org_id=p_org_id;
  insert into public.quote_discount_services(org_id,service_id,discount_allowed)
  select p_org_id,requested.service_id,true
  from (select distinct unnest(coalesce(p_service_ids,'{}'::uuid[])) service_id) requested;
end;
$function$
;
