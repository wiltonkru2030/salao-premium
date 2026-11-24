-- Protege pacotes por unidade e conserva a leitura do catálogo compartilhado.
-- Gerente pode alterar apenas pacotes da unidade atribuída. Pacotes centrais
-- continuam disponíveis para consulta e são administrados pelos papéis globais.
begin;

create policy service_packages_staff_branch_scope on public.service_packages
as restrictive for select to authenticated
using (
  branch_id is null
  or not private.has_org_role(org_id, array['manager','receptionist'])
  or private.has_staff_branch_scope(org_id, branch_id)
);

create policy service_package_items_staff_branch_scope on public.service_package_items
as restrictive for select to authenticated
using (
  not private.has_org_role(org_id, array['manager','receptionist'])
  or exists (
    select 1 from public.service_packages package
    where package.org_id = service_package_items.org_id and package.id = service_package_items.package_id
      and (package.branch_id is null or private.has_staff_branch_scope(package.org_id, package.branch_id))
  )
);

CREATE OR REPLACE FUNCTION private.save_service_package(p_org_id uuid, p_branch_id uuid, p_name text, p_description text, p_reference_price numeric, p_items jsonb, p_package_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_id uuid;
 v_line record;
 v_service uuid;
 v_quantity integer;
 v_pause integer;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager']),false)
 then raise exception 'Seu perfil não pode gerenciar pacotes.' using errcode='42501'; end if;
 if private.has_org_role(p_org_id, array['manager']) and not private.has_staff_branch_scope(p_org_id, p_branch_id) then
   raise exception 'Sem permissão para operar nesta unidade.' using errcode = '42501';
 end if;
 if p_branch_id is not null and not exists(
  select 1 from public.branches b where b.org_id=p_org_id and b.id=p_branch_id and b.active
 ) then raise exception 'Selecione uma unidade ativa.' using errcode='22023'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 120 or char_length(coalesce(p_description,''))>1000
 then raise exception 'Confira o nome e a descrição do pacote.' using errcode='22023'; end if;
 if p_reference_price is not null and
   (p_reference_price::text in ('NaN','Infinity','-Infinity') or p_reference_price<0
    or p_reference_price<>round(p_reference_price,2) or p_reference_price>9999999999.99)
 then raise exception 'Informe preço de referência válido, com dois decimais.' using errcode='22023'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20
 then raise exception 'Adicione de um a vinte serviços ao pacote.' using errcode='22023'; end if;

 -- Valida integralmente antes de substituir a composição atual.
 for v_line in select value,ordinality from jsonb_array_elements(p_items) with ordinality loop
   if jsonb_typeof(v_line.value)<>'object'
     or coalesce(v_line.value->>'service_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(v_line.value->>'quantity','') !~ '^[0-9]{1,2}$'
     or coalesce(v_line.value->>'pause_after_minutes','') !~ '^[0-9]{1,3}$'
   then raise exception 'Um item do pacote possui dados inválidos.' using errcode='22023'; end if;
   v_quantity:=(v_line.value->>'quantity')::integer;
   v_pause:=(v_line.value->>'pause_after_minutes')::integer;
   if v_quantity not between 1 and 20 or v_pause not between 0 and 720 then
     raise exception 'Quantidade ou pausa fora do limite permitido.' using errcode='22023';
   end if;
   select s.id into v_service from public.services s
    where s.org_id=p_org_id and s.id=(v_line.value->>'service_id')::uuid
      and s.active and (s.branch_id is null or s.branch_id=p_branch_id)
    for key share;
   if not found then raise exception 'O pacote contém serviço indisponível nesta unidade.' using errcode='22023'; end if;
 end loop;
 if p_package_id is null then
   insert into public.service_packages(org_id,branch_id,name,description,reference_price)
    values(p_org_id,p_branch_id,btrim(p_name),nullif(btrim(p_description),''),p_reference_price)
    returning id into v_id;
 else
   select p.id into v_id from public.service_packages p
    where p.org_id=p_org_id and p.id=p_package_id
      and (not private.has_org_role(p_org_id, array['manager'])
           or private.has_staff_branch_scope(p.org_id, p.branch_id))
    for update;
   if not found then raise exception 'O pacote selecionado não foi encontrado.' using errcode='22023'; end if;
   update public.service_packages set branch_id=p_branch_id,name=btrim(p_name),
    description=nullif(btrim(p_description),''),reference_price=p_reference_price,updated_at=now()
    where org_id=p_org_id and id=v_id;
   delete from public.service_package_items where org_id=p_org_id and package_id=v_id;
 end if;
 insert into public.service_package_items(org_id,package_id,service_id,sort_order,quantity,pause_after_minutes)
 select p_org_id,v_id,(value->>'service_id')::uuid,ordinality::integer,
   (value->>'quantity')::integer,(value->>'pause_after_minutes')::integer
 from jsonb_array_elements(p_items) with ordinality;
 return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.set_service_package_active(p_org_id uuid, p_package_id uuid, p_active boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_org_id,array['owner','admin','manager']),false)
 then raise exception 'Sem permissão para alterar pacotes.' using errcode='42501'; end if;
 if p_active is null then raise exception 'Informe a situação do pacote.' using errcode='22023'; end if;
 update public.service_packages p set active=p_active,updated_at=now()
 where p.org_id=p_org_id and p.id=p_package_id
   and (not private.has_org_role(p_org_id, array['manager'])
        or private.has_staff_branch_scope(p.org_id, p.branch_id))
 returning p.id into v_id;
 if v_id is null then raise exception 'Pacote não encontrado.' using errcode='22023'; end if;
 return v_id;
end;
$function$;

commit;
