-- Candidata para homologação: impede uso de serviço exclusivo fora da unidade.
-- Não aplicar antes de testar gravações da Agenda, Comanda, catálogo e vínculos profissionais.
begin;
create or replace function private.guard_service_branch_scope()
returns trigger language plpgsql security definer set search_path='' as $function$
declare v_branch uuid; v_service_branch uuid;
begin
 if tg_table_name='services' then
   if tg_op='UPDATE' then
     if new.branch_id is distinct from old.branch_id or new.org_id is distinct from old.org_id then
       raise exception 'O escopo de um serviço existente não pode ser alterado diretamente.' using errcode='23514';
     end if;
     return new;
   end if;
   if new.branch_id is not null and not exists(select 1 from public.branches b where b.org_id=new.org_id and b.id=new.branch_id and b.active) then
     raise exception 'Selecione uma unidade ativa desta organização.' using errcode='23514';
   end if;
   return new;
 end if;
 if tg_table_name='service_orders' then
   if exists(select 1 from public.service_order_items i join public.services s on s.org_id=i.org_id and s.id=i.service_id
      where i.org_id=old.org_id and i.order_id=old.id and s.branch_id is not null and s.branch_id is distinct from new.branch_id) then
     raise exception 'A comanda contém serviço exclusivo de outra unidade.' using errcode='23514';
   end if;
   return new;
 end if;
 if new.service_id is null then return new; end if;
 select s.branch_id into v_service_branch from public.services s where s.org_id=new.org_id and s.id=new.service_id;
 if not found then raise exception 'Serviço inválido para esta organização.' using errcode='23514'; end if;
 if v_service_branch is null then return new; end if;
 if tg_table_name='appointments' then
   v_branch:=new.branch_id;
 elsif tg_table_name='service_order_items' then
   select o.branch_id into v_branch from public.service_orders o where o.org_id=new.org_id and o.id=new.order_id for update;
   if not found then raise exception 'Comanda inválida para esta organização.' using errcode='23514'; end if;
 elsif tg_table_name='professional_services' then
   select p.branch_id into v_branch from public.professionals p where p.org_id=new.org_id and p.id=new.professional_id;
   if not found then raise exception 'Profissional inválido para esta organização.' using errcode='23514'; end if;
   if v_branch is null then return new; end if;
 end if;
 if v_service_branch is distinct from v_branch then
   raise exception 'Este serviço é exclusivo de outra unidade.' using errcode='23514';
 end if;
 return new;
end;
$function$;
revoke all on function private.guard_service_branch_scope() from public,anon,authenticated;
create trigger services_guard_branch_scope before insert or update of org_id,branch_id on public.services for each row execute function private.guard_service_branch_scope();
create trigger appointments_guard_service_branch before insert or update of org_id,branch_id,service_id on public.appointments for each row execute function private.guard_service_branch_scope();
create trigger service_order_items_guard_service_branch before insert or update of org_id,order_id,service_id on public.service_order_items for each row execute function private.guard_service_branch_scope();
create trigger service_orders_guard_service_branch before update of branch_id on public.service_orders for each row when (old.branch_id is distinct from new.branch_id) execute function private.guard_service_branch_scope();
create trigger professional_services_guard_service_branch before insert or update of org_id,professional_id,service_id on public.professional_services for each row execute function private.guard_service_branch_scope();
commit;
