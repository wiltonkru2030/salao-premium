-- Cadastro local de clientes pelo profissional, restrito à unidade principal atribuída.
-- Não amplia RLS da carteira administrativa nem altera identidade global.
create or replace function private.professional_customer_branch(target_org uuid)
returns uuid language sql stable security definer set search_path = '' as $$
 select p.branch_id from public.professionals p
 join public.branches b on b.org_id=p.org_id and b.id=p.branch_id and b.active
 where p.org_id=target_org and p.id=private.current_professional_id(target_org)
 and auth.uid() is not null
$$;
revoke all on function private.professional_customer_branch(uuid) from public,anon,authenticated;

-- Lista somente nome e telefone dos clientes ativos da unidade atribuída.
create or replace function private.list_professional_unit_customers(target_org uuid, page_offset integer default 0)
returns table(id uuid,name text,phone text,branch_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare unit uuid := private.professional_customer_branch(target_org);
begin
 if unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if page_offset is null or page_offset<0 then raise exception 'Página inválida.' using errcode='22023'; end if;
 return query select c.id,c.name,c.phone,c.branch_id from public.customers c
 where c.org_id=target_org and c.branch_id=unit and c.active
 order by c.name,c.id limit 200 offset page_offset;
end $$;

-- Salva nome e WhatsApp, sem editar vínculos, identificadores ou cadastros compartilhados.
create or replace function private.save_professional_unit_customer(target_org uuid,target_customer uuid,customer_name text,customer_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 unit uuid := private.professional_customer_branch(target_org);
 clean_name text := btrim(coalesce(customer_name,''));
 clean_phone text := regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g');
 saved public.customers%rowtype;
begin
 if unit is null then raise exception 'Unidade não autorizada.' using errcode='42501'; end if;
 if char_length(clean_name) not between 2 and 120 or clean_phone !~ '^[0-9]{10,11}$' then
  raise exception 'Nome ou telefone inválido.' using errcode='22023';
 end if;
 -- Serializa cadastros deste contrato por organização e telefone.
 perform pg_advisory_xact_lock(hashtextextended(target_org::text||':'||clean_phone,0));
 if exists(select 1 from public.customers c where c.org_id=target_org
  and (target_customer is null or c.id<>target_customer)
  and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') in (clean_phone,'55'||clean_phone)) then
  raise exception 'Já existe um cadastro com este telefone. Consulte o salão.' using errcode='23505';
 end if;
 if target_customer is null then
  insert into public.customers(org_id,branch_id,name,phone)
  values(target_org,unit,clean_name,clean_phone) returning * into saved;
 else
  update public.customers c set name=clean_name,phone=clean_phone
  where c.org_id=target_org and c.branch_id=unit and c.id=target_customer and c.active
  returning * into saved;
 end if;
 if saved.id is null then raise exception 'Cliente não autorizado.' using errcode='42501'; end if;
 return jsonb_build_object('id',saved.id,'name',saved.name,'phone',saved.phone,'branch_id',saved.branch_id);
end $$;

create or replace function public.list_professional_unit_customers(target_org uuid,page_offset integer default 0)
returns table(id uuid,name text,phone text,branch_id uuid)
language sql stable security invoker set search_path = '' as $$
 select * from private.list_professional_unit_customers($1,$2)
$$;
create or replace function public.save_professional_unit_customer(target_org uuid,target_customer uuid,customer_name text,customer_phone text)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.save_professional_unit_customer($1,$2,$3,$4)
$$;
revoke all on function private.list_professional_unit_customers(uuid,integer),public.list_professional_unit_customers(uuid,integer),private.save_professional_unit_customer(uuid,uuid,text,text),public.save_professional_unit_customer(uuid,uuid,text,text) from public,anon;
grant execute on function private.list_professional_unit_customers(uuid,integer),public.list_professional_unit_customers(uuid,integer),private.save_professional_unit_customer(uuid,uuid,text,text),public.save_professional_unit_customer(uuid,uuid,text,text) to authenticated;
