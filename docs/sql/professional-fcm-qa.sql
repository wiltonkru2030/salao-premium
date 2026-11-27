-- QA SOMENTE. Reproduz em uma transação os dois cenários positivos verificados separadamente.
-- Dados sintéticos; nenhuma conta existente é editada. Não executar em produção.
begin;
do $qa$
declare
 u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); product_id uuid:=gen_random_uuid();
 c uuid; s uuid; a uuid; ord uuid; item_key uuid; r jsonb;
 device_token text:='QA_'||replace(gen_random_uuid()::text,'-',''); job record;
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


 if not public.set_professional_push_device(o,device_token,true) then raise exception 'Registro falhou';end if;
 begin perform public.set_professional_push_device(other_org,device_token,true);raise exception 'Vínculo cruzado';exception when insufficient_privilege then null;end;
 begin perform public.claim_professional_push_deliveries();raise exception 'Fila exposta ao usuário';exception when insufficient_privilege then null;end;
 c:=(public.save_professional_unit_customer(o,null,'QA Cliente','67999991234')->>'id')::uuid;
 s:=public.save_professional_unit_service(o,null,'QA Corte','QA',30,50);
 a:=(public.create_professional_unit_appointment(o,c,s,v)->>'id')::uuid;
 execute 'reset role';
 execute 'set local role service_role';
 select * into job from public.claim_professional_push_deliveries() j where j.token=device_token;
 if job.notification_id is null then raise exception 'Entrega não reservada';end if;
 if exists(select 1 from public.claim_professional_push_deliveries() j where j.token=device_token) then raise exception 'Lease não protegeu duplicidade';end if;
 if not public.finish_professional_push_delivery(job.notification_id,job.device_id,job.lease_id,'sent') then raise exception 'Confirmação falhou';end if;
 if exists(select 1 from public.claim_professional_push_deliveries() j where j.token=device_token) then raise exception 'Entrega duplicada';end if;
 execute 'reset role';
 execute 'set local role authenticated';
 if public.set_professional_push_device(o,device_token,false) then raise exception 'Desativação falhou';end if;
 execute 'reset role';
 if exists(select 1 from private.professional_push_devices d where d.token=device_token) then raise exception 'Dispositivo não removido';end if;
end $qa$;
select 'QA fila FCM aprovada' as resultado;
rollback;
