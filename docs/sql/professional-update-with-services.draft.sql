-- RASCUNHO — atualização transacional do profissional e seus serviços habilitados.
-- Não aplicar em produção. Promover para migration após revisão, QA e geração via Supabase CLI.
-- O CPF de login não é alterado aqui: ele é armazenado por fluxo seguro próprio.

begin;

create or replace function private.update_professional_with_services(
  p_org_id uuid,
  p_professional_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_commission_rate numeric,
  p_tax_regime text,
  p_cnpj text,
  p_legal_name text,
  p_trade_name text,
  p_specialty text,
  p_service_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text:=btrim(coalesce(p_name,''));
  v_service_count integer;
  v_existing_count integer;
  v_access_enabled boolean;
begin
  if auth.uid() is null or not private.has_org_role(p_org_id,array['owner','admin']) then
    raise exception 'Sem permissão para editar profissionais.' using errcode='42501';
  end if;

  if p_professional_id is null or length(v_name) not between 2 and 120 then
    raise exception 'Profissional ou nome inválido.' using errcode='22023';
  end if;
  if p_commission_rate is null or p_commission_rate<0 or p_commission_rate>100 then
    raise exception 'Percentual de comissão inválido.' using errcode='22023';
  end if;
  if p_tax_regime is null or p_tax_regime not in ('individual','mei') then
    raise exception 'Tipo fiscal inválido.' using errcode='22023';
  end if;
  if length(coalesce(p_phone,''))>30 or length(coalesce(p_email,''))>254 or
     (coalesce(p_email,'')<>'' and lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Telefone ou e-mail inválido.' using errcode='22023';
  end if;
  if length(coalesce(p_specialty,''))>100 then
    raise exception 'Especialidade deve ter até 100 caracteres.' using errcode='22023';
  end if;
  if p_tax_regime='mei' and (
    coalesce(p_cnpj,'') !~ '^[0-9]{14}$' or
    length(btrim(coalesce(p_legal_name,''))) not between 2 and 160 or
    length(coalesce(p_trade_name,''))>160
  ) then
    raise exception 'Para MEI, informe CNPJ válido e razão social.' using errcode='22023';
  end if;
  if p_tax_regime='individual' and (p_cnpj is not null or p_legal_name is not null or p_trade_name is not null) then
    raise exception 'Dados de MEI não podem ser enviados para pessoa física.' using errcode='22023';
  end if;
  if coalesce(cardinality(p_service_ids),0)=0 or array_position(p_service_ids,null) is not null then
    raise exception 'Selecione ao menos um serviço válido.' using errcode='22023';
  end if;

  select access_enabled into v_access_enabled
    from public.professionals
   where org_id=p_org_id and id=p_professional_id
   for update;
  if not found then
    raise exception 'Profissional não encontrado.' using errcode='P0002';
  end if;

  select count(distinct service_id),count(*)
    into v_service_count,v_existing_count
    from public.services
   where org_id=p_org_id and id=any(p_service_ids) and active=true;
  if v_service_count<>cardinality(p_service_ids) or v_existing_count<>cardinality(p_service_ids) then
    raise exception 'Um ou mais serviços não existem, estão inativos ou pertencem a outra organização.' using errcode='22023';
  end if;

  update public.professionals
     set name=v_name,
         phone=nullif(btrim(coalesce(p_phone,'')),''),
         email=nullif(lower(btrim(coalesce(p_email,''))),''),
         commission_rate=p_commission_rate,
         tax_regime=p_tax_regime,
         cnpj=case when p_tax_regime='mei' then p_cnpj else null end,
         legal_name=case when p_tax_regime='mei' then nullif(btrim(p_legal_name),'') else null end,
         trade_name=case when p_tax_regime='mei' then nullif(btrim(coalesce(p_trade_name,'')),'') else null end,
         specialty=nullif(btrim(coalesce(p_specialty,'')),''),
         updated_at=now()
   where org_id=p_org_id and id=p_professional_id;

  delete from public.professional_services
   where org_id=p_org_id and professional_id=p_professional_id;

  insert into public.professional_services(org_id,professional_id,service_id)
  select p_org_id,p_professional_id,service_id
    from unnest(p_service_ids) as service_id;

  return jsonb_build_object(
    'professional_id',p_professional_id,
    'services_count',cardinality(p_service_ids),
    'access_enabled',v_access_enabled
  );
end;
$function$;

revoke all on function private.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function private.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) to authenticated;

create or replace function public.update_professional_with_services(
  p_org_id uuid,
  p_professional_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_commission_rate numeric,
  p_tax_regime text,
  p_cnpj text,
  p_legal_name text,
  p_trade_name text,
  p_specialty text,
  p_service_ids uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.update_professional_with_services(
    p_org_id,p_professional_id,p_name,p_phone,p_email,p_commission_rate,
    p_tax_regime,p_cnpj,p_legal_name,p_trade_name,p_specialty,p_service_ids
  );
$function$;

revoke all on function public.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) from public,anon;
grant execute on function public.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) to authenticated;

commit;
) then
    raise exception 'Telefone ou e-mail inválido.' using errcode='22023';
  end if;
  if length(coalesce(p_specialty,''))>100 then
    raise exception 'Especialidade deve ter até 100 caracteres.' using errcode='22023';
  end if;
  if p_tax_regime='mei' and (
    coalesce(p_cnpj,'') !~ '^[0-9]{14}$' or length(btrim(coalesce(p_legal_name,'')))<2
  ) then
    raise exception 'Para MEI, informe CNPJ válido e razão social.' using errcode='22023';
  end if;
  if p_tax_regime='individual' and (p_cnpj is not null or p_legal_name is not null or p_trade_name is not null) then
    raise exception 'Dados de MEI não podem ser enviados para pessoa física.' using errcode='22023';
  end if;
  if coalesce(cardinality(p_service_ids),0)=0 or array_position(p_service_ids,null) is not null then
    raise exception 'Selecione ao menos um serviço válido.' using errcode='22023';
  end if;

  select access_enabled into v_access_enabled
    from public.professionals
   where org_id=p_org_id and id=p_professional_id
   for update;
  if not found then
    raise exception 'Profissional não encontrado.' using errcode='P0002';
  end if;

  select count(distinct service_id),count(*)
    into v_service_count,v_existing_count
    from public.services
   where org_id=p_org_id and id=any(p_service_ids) and active=true;
  if v_service_count<>cardinality(p_service_ids) or v_existing_count<>cardinality(p_service_ids) then
    raise exception 'Um ou mais serviços não existem, estão inativos ou pertencem a outra organização.' using errcode='22023';
  end if;

  update public.professionals
     set name=v_name,
         phone=nullif(btrim(coalesce(p_phone,'')),''),
         email=nullif(lower(btrim(coalesce(p_email,''))),''),
         commission_rate=p_commission_rate,
         tax_regime=p_tax_regime,
         cnpj=case when p_tax_regime='mei' then p_cnpj else null end,
         legal_name=case when p_tax_regime='mei' then nullif(btrim(p_legal_name),'') else null end,
         trade_name=case when p_tax_regime='mei' then nullif(btrim(coalesce(p_trade_name,'')),'') else null end,
         specialty=nullif(btrim(coalesce(p_specialty,'')),''),
         updated_at=now()
   where org_id=p_org_id and id=p_professional_id;

  delete from public.professional_services
   where org_id=p_org_id and professional_id=p_professional_id;

  insert into public.professional_services(org_id,professional_id,service_id)
  select p_org_id,p_professional_id,service_id
    from unnest(p_service_ids) as service_id;

  return jsonb_build_object(
    'professional_id',p_professional_id,
    'services_count',cardinality(p_service_ids),
    'access_enabled',v_access_enabled
  );
end;
$function$;

revoke all on function private.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function private.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) to authenticated;

create or replace function public.update_professional_with_services(
  p_org_id uuid,
  p_professional_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_commission_rate numeric,
  p_tax_regime text,
  p_cnpj text,
  p_legal_name text,
  p_trade_name text,
  p_specialty text,
  p_service_ids uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.update_professional_with_services(
    p_org_id,p_professional_id,p_name,p_phone,p_email,p_commission_rate,
    p_tax_regime,p_cnpj,p_legal_name,p_trade_name,p_specialty,p_service_ids
  );
$function$;

revoke all on function public.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) from public,anon;
grant execute on function public.update_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) to authenticated;

commit;
