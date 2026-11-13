-- RPCs atômicas de Orçamentos com validação de organização e permissões.
CREATE OR REPLACE FUNCTION public.create_quote_with_items(p_org_id uuid, p_branch_id uuid, p_customer_id uuid, p_valid_until date, p_notes text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
  v_item jsonb;
  v_service public.services%rowtype;
  v_professional_id uuid;
  v_quantity numeric(10,3);
  v_discount_mode text;
  v_discount_input numeric(12,2);
  v_base numeric(12,2);
  v_discount numeric(12,2);
  v_max_discount numeric(5,2);
  v_allow_fixed boolean;
  v_sort integer := 0;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if not private.has_org_role(p_org_id,array['owner','admin','manager','receptionist']) then
    raise exception 'Você não tem permissão para criar orçamentos nesta organização.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Adicione entre 1 e 100 serviços ao orçamento.';
  end if;
  if not exists(select 1 from public.customers c where c.id=p_customer_id and c.org_id=p_org_id and c.active) then
    raise exception 'Cliente inválido para esta organização.';
  end if;
  if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.org_id=p_org_id and b.active) then
    raise exception 'Unidade inválida para esta organização.';
  end if;

  select coalesce(qs.max_discount_percent,0),coalesce(qs.allow_fixed_discount,true)
    into v_max_discount,v_allow_fixed
  from public.quote_settings qs where qs.org_id=p_org_id;
  v_max_discount:=coalesce(v_max_discount,0);
  v_allow_fixed:=coalesce(v_allow_fixed,true);

  insert into public.quotes(org_id,branch_id,customer_id,status,valid_until,notes,created_by)
  values(p_org_id,p_branch_id,p_customer_id,'pending',p_valid_until,nullif(left(coalesce(p_notes,''),1000),''),v_user)
  returning * into v_quote;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_sort:=v_sort+1;
    select * into v_service
    from public.services s
    where s.id=(v_item->>'service_id')::uuid and s.org_id=p_org_id and s.active;
    if not found then raise exception 'Um dos serviços não está ativo nesta organização.'; end if;

    v_professional_id:=nullif(v_item->>'professional_id','')::uuid;
    if v_professional_id is not null then
      if not exists(select 1 from public.professionals p where p.id=v_professional_id and p.org_id=p_org_id and p.active) then
        raise exception 'Um dos profissionais não está ativo nesta organização.';
      end if;
      if not exists(select 1 from public.professional_services ps where ps.org_id=p_org_id and ps.professional_id=v_professional_id and ps.service_id=v_service.id) then
        raise exception 'O profissional selecionado não está habilitado para um dos serviços.';
      end if;
    end if;

    v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
    if v_quantity<=0 or v_quantity>1000 then raise exception 'Quantidade de serviço inválida.'; end if;
    v_base:=round(v_quantity*v_service.price,2);
    v_discount_mode:=coalesce(v_item->>'discount_mode','percent');
    v_discount_input:=coalesce(nullif(v_item->>'discount_value','')::numeric,0);

    if v_discount_mode='percent' then
      if v_discount_input<0 or v_discount_input>v_max_discount then raise exception 'Desconto acima do limite configurado para o salão.'; end if;
      v_discount:=round(v_base*v_discount_input/100,2);
    elsif v_discount_mode='fixed' then
      if not v_allow_fixed then raise exception 'O salão não permite desconto em valor fixo.'; end if;
      if v_discount_input<0 or v_discount_input>v_base then raise exception 'Valor de desconto inválido.'; end if;
      if v_base>0 and (v_discount_input/v_base*100)>v_max_discount then raise exception 'Desconto acima do limite configurado para o salão.'; end if;
      v_discount:=round(v_discount_input,2);
    else
      raise exception 'Tipo de desconto inválido.';
    end if;

    if v_discount>0 and not exists(
      select 1 from public.quote_discount_services r
      where r.org_id=p_org_id and r.service_id=v_service.id and r.discount_allowed
    ) then raise exception 'Este serviço não permite desconto.'; end if;

    insert into public.quote_items(
      org_id,quote_id,service_id,professional_id,description,quantity,duration_minutes,
      unit_price,discount_amount,total,sort_order,discount_mode
    ) values(
      p_org_id,v_quote.id,v_service.id,v_professional_id,v_service.name,v_quantity,
      greatest(1,v_service.duration_minutes),v_service.price,v_discount,v_base-v_discount,v_sort,v_discount_mode
    );
  end loop;

  select * into v_quote from public.quotes q where q.id=v_quote.id and q.org_id=p_org_id;
  return to_jsonb(v_quote);
end;
$function$
;

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
