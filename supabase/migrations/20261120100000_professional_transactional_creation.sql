-- SALÃO PREMIUM — cadastro transacional de profissional e serviços habilitados.
-- A operação cria profissional + vínculos em uma única transação PostgreSQL.
-- CPF não é persistido nesta tabela: o provisionamento de credencial continua no serviço de acesso.

begin;

create or replace function private.create_professional_with_services(
  p_org_id uuid,
  p_branch_id uuid,
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text:=btrim(coalesce(p_name,''));
  v_professional_id uuid;
  v_service_count integer;
  v_branch_exists boolean;
begin
  if auth.uid() is null or not private.is_org_admin(p_org_id) then
    raise exception 'Somente proprietário ou administrador pode cadastrar profissionais.' using errcode='42501';
  end if;
  if length(v_name) not between 2 and 120 then
    raise exception 'Informe o nome do profissional.' using errcode='22023';
  end if;
  if p_branch_id is not null then
    select exists(
      select 1 from public.branches b
      where b.org_id=p_org_id and b.id=p_branch_id and b.active=true
    ) into v_branch_exists;
    if not coalesce(v_branch_exists,false) then
      raise exception 'A unidade selecionada não pertence à organização ou está inativa.' using errcode='22023';
    end if;
  end if;
  if p_commission_rate is null or p_commission_rate<0 or p_commission_rate>100 then
    raise exception 'A comissão deve estar entre 0 e 100 por cento.' using errcode='22023';
  end if;
  if p_tax_regime is null or p_tax_regime not in ('individual','mei') then
    raise exception 'Regime fiscal inválido.' using errcode='22023';
  end if;
  if p_tax_regime='mei' and (
    length(regexp_replace(coalesce(p_cnpj,''),'[^0-9]','','g'))<>14
    or length(btrim(coalesce(p_legal_name,'')))<2
  ) then
    raise exception 'Para MEI, informe CNPJ e razão social válidos.' using errcode='22023';
  end if;
  if p_service_ids is null or cardinality(p_service_ids)=0 then
    raise exception 'Selecione ao menos um serviço.' using errcode='22023';
  end if;
  if cardinality(p_service_ids)<>(select count(distinct service_id) from unnest(p_service_ids) as items(service_id)) then
    raise exception 'A lista de serviços contém itens duplicados.' using errcode='22023';
  end if;

  select count(*) into v_service_count
  from public.services s
  where s.org_id=p_org_id and s.id=any(p_service_ids) and s.active=true;
  if v_service_count<>cardinality(p_service_ids) then
    raise exception 'Um ou mais serviços não existem, estão inativos ou pertencem a outra organização.' using errcode='22023';
  end if;

  insert into public.professionals(
    org_id,branch_id,name,phone,email,commission_rate,active,tax_regime,cnpj,
    legal_name,trade_name,specialty
  ) values (
    p_org_id,p_branch_id,v_name,nullif(btrim(coalesce(p_phone,'')),''),
    nullif(lower(btrim(coalesce(p_email,''))),''),
    p_commission_rate,true,p_tax_regime,
    case when p_tax_regime='mei' then regexp_replace(coalesce(p_cnpj,''),'[^0-9]','','g') else null end,
    case when p_tax_regime='mei' then nullif(btrim(coalesce(p_legal_name,'')),'') else null end,
    case when p_tax_regime='mei' then nullif(btrim(coalesce(p_trade_name,'')),'') else null end,
    nullif(btrim(coalesce(p_specialty,'')),'')
  ) returning id into v_professional_id;

  insert into public.professional_services(org_id,professional_id,service_id)
  select p_org_id,v_professional_id,items.service_id
  from unnest(p_service_ids) as items(service_id);

  return v_professional_id;
end;
$function$;

comment on function private.create_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) is 'Cria profissional e vínculos de serviços de forma atômica; exige owner/admin ativo no tenant.';

revoke all on function private.create_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function private.create_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) to authenticated;

create or replace function public.create_professional_with_services(
  p_org_id uuid,
  p_branch_id uuid,
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
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.create_professional_with_services(
    p_org_id,p_branch_id,p_name,p_phone,p_email,p_commission_rate,p_tax_regime,
    p_cnpj,p_legal_name,p_trade_name,p_specialty,p_service_ids
  );
$function$;

comment on function public.create_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) is 'Wrapper SECURITY INVOKER para cadastro transacional de profissional.';

revoke all on function public.create_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) from public,anon;
grant execute on function public.create_professional_with_services(uuid,uuid,text,text,text,numeric,text,text,text,text,text,uuid[]) to authenticated;

commit;
