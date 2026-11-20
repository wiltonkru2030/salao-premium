-- Candidata QA: preserva contratos, ACL e RLS dos RPCs invoker existentes.
-- Não aplicar sem testar agendamentos agrupados, validade, descontos e comanda integrada.
begin;
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Adicione entre 1 e 100 serviços ao orçamento.';
  end if;
  if not exists(select 1 from public.customers c where c.id=p_customer_id and c.org_id=p_org_id and c.active) then
    raise exception 'Cliente inválido para esta organização.';
  end if;
  if p_branch_id is null or not exists(select 1 from public.branches b where b.id=p_branch_id and b.org_id=p_org_id and b.active) then
    raise exception 'Unidade inválida para esta organização.';
  end if;

  if p_valid_until is not null and p_valid_until<(now() at time zone (select o.timezone from public.organizations o where o.id=p_org_id))::date then raise exception 'A validade precisa ser hoje ou uma data futura.' using errcode='22023'; end if;
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
    where s.id=(v_item->>'service_id')::uuid and s.org_id=p_org_id and s.active and (s.branch_id is null or s.branch_id=p_branch_id);
    if not found then raise exception 'Um dos serviços não está ativo nesta organização.'; end if;

    v_professional_id:=nullif(v_item->>'professional_id','')::uuid;
    if v_professional_id is not null then
      if not exists(select 1 from public.professionals p where p.id=v_professional_id and p.org_id=p_org_id and p.active and (p.branch_id is null or p.branch_id=p_branch_id)) then
        raise exception 'Um dos profissionais não está ativo nesta organização.';
      end if;
      if not exists(select 1 from public.professional_services ps where ps.org_id=p_org_id and ps.professional_id=v_professional_id and ps.service_id=v_service.id) then
        raise exception 'O profissional selecionado não está habilitado para um dos serviços.';
      end if;
    end if;

    if coalesce(nullif(v_item->>'quantity','')::numeric,1)::text in ('NaN','Infinity','-Infinity') or coalesce(nullif(v_item->>'quantity','')::numeric,1)<>trunc(coalesce(nullif(v_item->>'quantity','')::numeric,1)) or coalesce(nullif(v_item->>'quantity','')::numeric,1) not between 1 and 1000 then raise exception 'Quantidade inteira entre 1 e 1.000 obrigatória.' using errcode='22023'; end if;
    v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
    if v_quantity<=0 or v_quantity>1000 then raise exception 'Quantidade de serviço inválida.'; end if;
    v_base:=round(v_quantity*v_service.price,2);
    v_discount_mode:=coalesce(v_item->>'discount_mode','percent');
    if coalesce(nullif(v_item->>'discount_value','')::numeric,0)::text in ('NaN','Infinity','-Infinity') or coalesce(nullif(v_item->>'discount_value','')::numeric,0)<>round(coalesce(nullif(v_item->>'discount_value','')::numeric,0),2) then raise exception 'Informe desconto em até duas casas decimais.' using errcode='22023'; end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.create_quote_appointment_group(p_quote_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
  v_customer public.customers%rowtype;
  v_group public.appointment_groups%rowtype;
  v_item record;
  v_quote_item public.quote_items%rowtype;
  v_professional public.professionals%rowtype;
  v_appointment public.appointments%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_count integer;
  v_distinct integer;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_quote from public.quotes q where q.id=p_quote_id for update;
  if not found or v_quote.status<>'accepted' then raise exception 'Somente orçamentos aceitos podem ser agendados.'; end if;
  if not private.has_org_role(v_quote.org_id,array['owner','admin','manager','receptionist']) then raise exception 'Sem permissão para agendar este orçamento.'; end if;
  if v_quote.branch_id is null or not exists(select 1 from public.branches b where b.id=v_quote.branch_id and b.org_id=v_quote.org_id and b.active) then raise exception 'Selecione uma unidade ativa no orçamento.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Informe os horários de todos os serviços.'; end if;
  select count(*) into v_count from public.quote_items qi where qi.org_id=v_quote.org_id and qi.quote_id=v_quote.id;
  select count(distinct x.quote_item_id) into v_distinct from jsonb_to_recordset(p_items) as x(quote_item_id uuid,professional_id uuid,starts_at timestamptz,ends_at timestamptz);
  if v_count<>jsonb_array_length(p_items) or v_distinct<>v_count then raise exception 'Cada serviço do orçamento deve receber exatamente um horário.'; end if;
  -- A restrição UNIQUE(org_id,quote_id) é a última barreira contra duplicação.
  if exists(select 1 from public.appointment_groups g where g.org_id=v_quote.org_id and g.quote_id=v_quote.id) then raise exception 'Este orçamento já possui agendamentos. Consulte a Agenda.' using errcode='23505'; end if;
  -- Ordem determinística dos locks previne disputa entre grupos multiprofissionais.
  perform pg_advisory_xact_lock(hashtextextended(v_quote.org_id::text||':'||x.professional_id::text,0)) from (select distinct professional_id from jsonb_to_recordset(p_items) as t(professional_id uuid) where professional_id is not null order by professional_id) x;
  select * into v_customer from public.customers c where c.org_id=v_quote.org_id and c.id=v_quote.customer_id;
  if not found then raise exception 'Cliente do orçamento não encontrado.'; end if;
  insert into public.appointment_groups(org_id,branch_id,customer_id,quote_id,created_by)
  values(v_quote.org_id,v_quote.branch_id,v_quote.customer_id,v_quote.id,v_user) returning * into v_group;
  for v_item in select * from jsonb_to_recordset(p_items) as x(quote_item_id uuid,professional_id uuid,starts_at timestamptz,ends_at timestamptz) loop
    select * into v_quote_item from public.quote_items qi where qi.org_id=v_quote.org_id and qi.quote_id=v_quote.id and qi.id=v_item.quote_item_id;
    if not found then raise exception 'Serviço do orçamento inválido.'; end if;
    if v_item.professional_id is null or v_item.starts_at is null or v_item.ends_at is null or not isfinite(v_item.starts_at) or not isfinite(v_item.ends_at) or v_item.starts_at<=clock_timestamp() or v_item.ends_at<=v_item.starts_at
       or extract(epoch from (v_item.ends_at-v_item.starts_at)) <> (v_quote_item.duration_minutes * v_quote_item.quantity * 60) then
      raise exception 'Informe profissional e horário com a duração correta para cada serviço, considerando a quantidade.';
    end if;
    if v_quote_item.professional_id is not null and v_item.professional_id<>v_quote_item.professional_id then raise exception 'O profissional definido no orçamento não pode ser substituído.'; end if;
    if not exists(select 1 from public.services s where s.org_id=v_quote.org_id and s.id=v_quote_item.service_id and s.active and (s.branch_id is null or s.branch_id=v_quote.branch_id)) then raise exception 'Serviço indisponível nesta unidade.'; end if;
    select * into v_professional from public.professionals p where p.org_id=v_quote.org_id and p.id=v_item.professional_id and p.active and (p.branch_id is null or p.branch_id=v_quote.branch_id);
    if not found then raise exception 'Profissional inválido ou inativo.'; end if;
    if not exists(
      select 1 from public.professional_services ps
      where ps.org_id=v_quote.org_id
        and ps.professional_id=v_professional.id
        and ps.service_id=v_quote_item.service_id
    ) then
      raise exception 'O profissional selecionado não está habilitado para este serviço.';
    end if;
    if exists(select 1 from public.appointments a where a.org_id=v_quote.org_id and a.professional_id=v_item.professional_id and a.status not in ('cancelled','completed','no_show') and a.starts_at<v_item.ends_at and a.ends_at>v_item.starts_at) then raise exception 'Conflito de horário para %.',v_professional.name; end if;
    if exists(select 1 from public.appointment_blocks b where b.org_id=v_quote.org_id and (b.professional_id is null or b.professional_id=v_item.professional_id) and (b.branch_id is null or b.branch_id=v_quote.branch_id) and b.starts_at<v_item.ends_at and b.ends_at>v_item.starts_at) then raise exception 'O horário de % está bloqueado.',v_professional.name; end if;
    insert into public.appointments(org_id,branch_id,customer_id,professional_id,service_id,customer_name,customer_phone,service_name,professional_name,starts_at,ends_at,status,price,booking_source,created_by,appointment_group_id)
    values(v_quote.org_id,v_quote.branch_id,v_quote.customer_id,v_professional.id,v_quote_item.service_id,v_customer.name,v_customer.phone,v_quote_item.description,v_professional.name,v_item.starts_at,v_item.ends_at,'scheduled',v_quote_item.total,'salon',v_user,v_group.id)
    returning * into v_appointment;
    insert into public.appointment_group_items(org_id,appointment_group_id,quote_item_id,appointment_id,service_id,professional_id,starts_at,ends_at,price)
    values(v_quote.org_id,v_group.id,v_quote_item.id,v_appointment.id,v_quote_item.service_id,v_professional.id,v_item.starts_at,v_item.ends_at,v_quote_item.total);
    v_ids:=array_append(v_ids,v_appointment.id);
  end loop;
  return jsonb_build_object('group_id',v_group.id,'appointment_ids',to_jsonb(v_ids),'count',cardinality(v_ids));
end; $function$;

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
  if p_max_discount_percent is null or p_max_discount_percent::text in ('NaN','Infinity','-Infinity') or p_max_discount_percent<>round(p_max_discount_percent,2) or p_max_discount_percent<0 or p_max_discount_percent>100 then
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
$function$;
commit;
