-- Valida o cadastro fiscal MEI pela RPC e pela constraint em QA.
-- Fixtures isoladas na transação, com identidade autenticada e rollback.
begin;

insert into auth.users (id,email,raw_user_meta_data) values
 ('a7d80000-0000-4000-8000-000000000001','qa-cnpj-owner@salaopremium.test',
  '{"organization_name":"QA CNPJ alfanumérico"}'),
 ('a7d80000-0000-4000-8000-000000000002','qa-cnpj-manager@salaopremium.test',
  '{"account_type":"staff"}');

insert into public.org_memberships(org_id,user_id,role)
select id,'a7d80000-0000-4000-8000-000000000002','manager'
from public.organizations where name='QA CNPJ alfanumérico';

insert into public.services (org_id,name,duration_minutes,price)
select id,'Serviço fiscal QA',30,20 from public.organizations where name='QA CNPJ alfanumérico';

set local role authenticated;
select set_config('request.jwt.claim.sub','a7d80000-0000-4000-8000-000000000001',true);

do $qa$
declare
  salon_id uuid;
  selected_service_id uuid;
  created_professional_id uuid;
begin
  select id into strict salon_id from public.organizations where name='QA CNPJ alfanumérico';
  select id into strict selected_service_id from public.services
    where org_id=salon_id and name='Serviço fiscal QA';

  if not private.valid_professional_cnpj('04.252.011/0001-10')
     or private.valid_professional_cnpj('00.000.000/0000-00') then
    raise exception 'Validação do formato numérico divergiu';
  end if;

  created_professional_id := public.create_professional_with_services(
    salon_id,null,'Profissional fiscal QA',null,null,20,'mei',
    '12.abc.345/01de-35','Empresa fiscal QA',null,null,array[selected_service_id]
  );
  if (select cnpj from public.professionals where id=created_professional_id) is distinct from '12ABC34501DE35'
     or not exists (select 1 from public.professional_services ps
       where ps.professional_id=created_professional_id and ps.service_id=selected_service_id) then
    raise exception 'Cadastro fiscal ou vínculo de serviço incorreto';
  end if;

  begin
    perform public.create_professional_with_services(
      salon_id,null,'Profissional inválido QA',null,null,20,'mei',
      '12ABC34501DE36','Empresa fiscal QA',null,null,array[selected_service_id]
    );
    raise exception 'A RPC aceitou dígitos inválidos';
  exception when invalid_parameter_value then null;
  end;

  begin
    update public.professionals set cnpj='12ABC34501DEB5' where id=created_professional_id;
    raise exception 'A escrita direta aceitou letras nos dígitos verificadores';
  exception when check_violation then null;
  end;

  update public.professionals set cnpj='04252011000110' where id=created_professional_id;
  if (select cnpj from public.professionals where id=created_professional_id) is distinct from '04252011000110' then
    raise exception 'A edição com documento numérico falhou';
  end if;

  perform set_config('request.jwt.claim.sub','a7d80000-0000-4000-8000-000000000002',true);
  begin
    perform public.create_professional_with_services(
      salon_id,null,'Cadastro fora do papel QA',null,null,20,'mei',
      '12ABC34501DE35','Empresa fiscal QA',null,null,array[selected_service_id]
    );
    raise exception 'Gerente recebeu permissão indevida de cadastro';
  exception when insufficient_privilege then null;
  end;
end
$qa$;

reset role;
select 'CNPJ numérico e alfanumérico no cadastro e na edição' as scenario,'ok' as result;
rollback;
