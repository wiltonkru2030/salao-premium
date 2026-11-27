-- QA SOMENTE. Reproduz em uma transação os dois cenários positivos verificados separadamente.
-- Dados sintéticos; nenhuma conta existente é editada. Não executar em produção.
begin;
do $qa$
declare
 u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); product_id uuid:=gen_random_uuid();
 c uuid; s uuid; a uuid; ord uuid; item_key uuid; r jsonb;
 v timestamp:=(current_date+2)+time '10:00';
begin
 insert into auth.users(id,email) values(u,'qa-'||u||'@example.invalid');
 insert into public.profiles(id,full_name) values(u,'QA fictício') on conflict(id) do nothing;
 insert into public.organizations(id,name,timezone)
 values(o,'QA fictício','America/Campo_Grande'),(other_org,'QA outro','America/Campo_Grande');
 insert into public.branches(id,org_id,name,is_main) values(b,o,'QA unidade',true);
 insert into public.org_memberships(org_id,user_id,role,status) values(o,u,'professional','active');
 insert into public.professionals(id,org_id,branch_id,profile_id,name,active,access_enabled,can_edit_own_orders)
 values(p,o,b,u,'QA fictício',true,true,true);
 insert into public.branch_business_hours(org_id,branch_id,weekday,opens_at,closes_at)
 values(o,b,extract(dow from v)::int,'08:00','18:00') on conflict do nothing;
 insert into public.professional_working_hours(org_id,professional_id,weekday,starts_at,ends_at)
 values(o,p,extract(dow from v)::int,'08:00','18:00') on conflict do nothing;
 insert into public.products(id,org_id,branch_id,name,sale_price,stock_quantity)
 values(product_id,o,b,'QA Produto',20,10);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';

 -- Cadastro, vínculo, preferências e isolamento.
 c:=(public.save_professional_unit_customer(o,null,'QA Cliente','67999991234')->>'id')::uuid;
 if c is null or not exists(select 1 from public.list_professional_unit_customers(o,0) where id=c)
 then raise exception 'Falha clientes'; end if;
 s:=public.save_professional_unit_service(o,null,'QA Corte','QA',30,50);
 if s is null or not exists(select 1 from public.list_professional_unit_services(o,0) where id=s and linked and editable)
 then raise exception 'Falha serviços'; end if;
 r:=public.save_professional_app_preferences(o,'qa@example.invalid','email','qa@example.invalid',null,true,true);
 if r->>'pix_key' is distinct from 'qa@example.invalid' then raise exception 'Falha perfil'; end if;
 begin
  perform public.get_professional_app_preferences(other_org);
  raise exception 'Acesso cruzado permitido';
 exception when insufficient_privilege then null;
 end;

 -- Agenda e notificações.
 a:=(public.create_professional_unit_appointment(o,c,s,v)->>'id')::uuid;
 if a is null then raise exception 'Falha agenda'; end if;
 begin
  perform public.create_professional_unit_appointment(o,c,s,v);
  raise exception 'Conflito permitido';
 exception when exclusion_violation then null;
 end;
 r:=public.get_professional_notifications(o,false);
 if coalesce((r->>'unread_count')::int,0)<1 then raise exception 'Falha notificação'; end if;
 perform public.mark_professional_notifications_read(o,null);
 if (public.get_professional_notifications(o,false)->>'unread_count')::int is distinct from 0
 then raise exception 'Falha leitura'; end if;


 -- Revogação sem alterar o JWT simulado: RLS e contratos devem rejeitar a sessão antiga.
 if not exists(select 1 from public.appointments where id=a) then raise exception 'Agenda própria inacessível';end if;
 execute 'reset role';
 update public.professionals set access_enabled=false where id=p and org_id=o;
 execute 'set local role authenticated';
 if exists(select 1 from public.appointments where id=a) then raise exception 'Agenda visível após revogação';end if;
 if exists(select 1 from public.professional_services where org_id=o and professional_id=p) then raise exception 'Serviços visíveis após revogação';end if;
 begin perform public.get_professional_notifications(o,false);raise exception 'Notificação visível após revogação';exception when insufficient_privilege then null;end;
 begin perform public.list_professional_unit_customers(o,0);raise exception 'Cliente visível após revogação';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.professionals set access_enabled=true where id=p and org_id=o;
 update public.org_memberships set status='suspended' where org_id=o and user_id=u;
 execute 'set local role authenticated';
 if exists(select 1 from public.appointments where id=a) then raise exception 'Agenda visível após perda de vínculo';end if;
 begin perform public.get_professional_app_preferences(o);raise exception 'Perfil visível após perda de vínculo';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $qa$;
select 'QA: revogação e perda de vínculo bloqueadas com sessão antiga' as resultado;
rollback;