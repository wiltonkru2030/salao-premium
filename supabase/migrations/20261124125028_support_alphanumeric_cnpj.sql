-- CNPJ numérico e alfanumérico no cadastro fiscal de profissionais MEI.
-- As regras da Receita Federal preservam os dois dígitos numéricos e usam ASCII menos 48.
-- A constraint valida também escritas diretas. A RPC define owner/admin como operadores.
-- Inclui a definição transacional completa para ambientes onde ela ainda não foi aplicada.
begin;

create function private.normalize_professional_cnpj(value text)
returns text language sql immutable strict security invoker set search_path = ''
as $function$
  select case when value collate pg_catalog."C" ~ '^[0-9A-Za-z./[:space:]-]*$'
    then upper(regexp_replace(value collate pg_catalog."C", '[./[:space:]-]', '', 'g'))
    else '' end;
$function$;

create function private.valid_professional_cnpj(value text)
returns boolean language plpgsql immutable strict security invoker set search_path = ''
as $function$
declare
  document text := private.normalize_professional_cnpj(value);
  base text;
  total integer;
  remainder integer;
  first_digit integer;
  second_digit integer;
  position integer;
begin
  if document collate pg_catalog."C" !~ '^[0-9A-Z]{12}[0-9]{2}$'
     or document ~ '^([0-9])\1{13}$' then return false; end if;
  base := left(document,12);
  total := 0;
  for position in 1..12 loop
    total := total + (ascii(substr(base,position,1))-48) * (2+(12-position)%8);
  end loop;
  remainder := total % 11;
  first_digit := case when remainder < 2 then 0 else 11-remainder end;
  base := base || first_digit;
  total := 0;
  for position in 1..13 loop
    total := total + (ascii(substr(base,position,1))-48) * (2+(13-position)%8);
  end loop;
  remainder := total % 11;
  second_digit := case when remainder < 2 then 0 else 11-remainder end;
  return right(document,2) = first_digit::text || second_digit::text;
end;
$function$;

revoke all on function private.normalize_professional_cnpj(text), private.valid_professional_cnpj(text)
  from public, anon, authenticated;
grant execute on function private.normalize_professional_cnpj(text), private.valid_professional_cnpj(text)
  to authenticated, service_role;

alter table public.professionals drop constraint professionals_mei_cnpj_check;
alter table public.professionals add constraint professionals_mei_cnpj_check
  check (tax_regime <> 'mei' or private.valid_professional_cnpj(cnpj) is true);

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
  if auth.uid() is null or not private.has_org_role(p_org_id,array['owner','admin']) then
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
    private.valid_professional_cnpj(p_cnpj) is not true
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
  where s.org_id=p_org_id and s.id=any(p_service_ids) and s.active=true
    and (p_branch_id is null or s.branch_id is null or s.branch_id=p_branch_id);
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
    case when p_tax_regime='mei' then private.normalize_professional_cnpj(p_cnpj) else null end,
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
