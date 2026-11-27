-- QA SOMENTE. Reproduz em uma transação os dois cenários positivos verificados separadamente.
-- Dados sintéticos; nenhuma conta existente é editada. Não executar em produção.
begin;
do $qa$
declare
 u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); product_id uuid:=gen_random_uuid();
 c uuid; s uuid; a uuid; ord uuid; item_key uuid; r jsonb;
 u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid(); c2 uuid; s2 uuid; a2 uuid; notification uuid;
 b3 uuid:=gen_random_uuid(); multi_customer uuid; multi_service uuid; multi_appt uuid;
 v timestamp:=(current_date+2)+time '10:00';
begin
 insert into auth.users(id,email) values(u,'qa-'||u||'@example.invalid');
 insert into public.profiles(id,full_name) values(u,'QA fictício') on conflict(id) do nothing;
 insert into auth.users(id,email) values(u2,'qa-'||u2||'@example.invalid'),(u3,'qa-'||u3||'@example.invalid');
 insert into public.profiles(id,full_name) values(u2,'QA segundo'),(u3,'QA terceiro') on conflict(id) do nothing;
 insert into public.organizations(id,name,timezone)
 values(o,'QA fictício','America/Campo_Grande'),(other_org,'QA outro','America/Campo_Grande');
 insert into public.branches(id,org_id,name,is_main) values(b,o,'QA unidade',true);
 insert into public.branches(id,org_id,name,is_main) values(b2,o,'QA filial',false);
 insert into public.branches(id,org_id,name,is_main) values(b3,o,'QA não atribuída',false);
 insert into public.org_memberships(org_id,user_id,role,status) values(o,u,'professional','active'),(o,u2,'professional','active'),(o,u3,'professional','active');
 insert into public.professionals(id,org_id,branch_id,profile_id,name,active,access_enabled,can_edit_own_orders)
 values(p,o,b,u,'QA fictício',true,true,true),(p2,o,b,u2,'QA segundo',true,true,true),(p3,o,b2,u3,'QA terceiro',true,true,true);
 insert into public.branch_business_hours(org_id,branch_id,weekday,opens_at,closes_at)
 values(o,b,extract(dow from v)::int,'08:00','18:00'),(o,b2,extract(dow from v)::int,'08:00','18:00') on conflict do nothing;
 insert into public.professional_working_hours(org_id,professional_id,weekday,starts_at,ends_at)
 values(o,p,extract(dow from v)::int,'08:00','18:00'),(o,p2,extract(dow from v)::int,'08:00','18:00'),(o,p3,extract(dow from v)::int,'08:00','18:00') on conflict do nothing;
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


 -- Mesmo salão e mesma unidade: carteira local compartilhada, agenda e autoria individuais.
 notification:=(public.get_professional_notifications(o,false)->'items'->0->>'id')::uuid;
 if notification is null then raise exception 'Notificação inicial ausente'; end if;
 ord:=(public.professional_attendance_action(o,a,'start')->>'order_id')::uuid;
 perform set_config('request.jwt.claim.sub',u2::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u2,'role','authenticated')::text,true);
 if exists(select 1 from public.appointments where id=a) then raise exception 'Agenda alheia visível';end if;
 if exists(select 1 from public.service_orders where id=ord) then raise exception 'Comanda alheia visível';end if;
 if not exists(select 1 from public.list_professional_unit_customers(o,0) where id=c) then raise exception 'Carteira compartilhada indisponível';end if;
 if not exists(select 1 from public.list_professional_unit_services(o,0) where id=s and not editable and not linked) then raise exception 'Autoria indevida';end if;
 begin perform public.save_professional_unit_service(o,s,'QA indevido','QA',30,50);raise exception 'Edição alheia permitida';exception when insufficient_privilege then null;end;
 begin perform public.professional_attendance_action(o,a,'finish');raise exception 'Atendimento alheio permitido';exception when insufficient_privilege then null;end;
 if public.mark_professional_notifications_read(o,notification)<>0 then raise exception 'Leitura alheia alterada';end if;
 if (public.get_professional_notifications(o,false)->>'unread_count')::int<>0 then raise exception 'Notificação alheia visível';end if;
 -- Filial diferente: catálogo local e clientes da primeira unidade não aparecem.
 perform set_config('request.jwt.claim.sub',u3::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u3,'role','authenticated')::text,true);
 if exists(select 1 from public.list_professional_unit_customers(o,0) where id=c) then raise exception 'Cliente de outra filial visível';end if;
 if exists(select 1 from public.list_professional_unit_services(o,0) where id=s) then raise exception 'Serviço de outra filial visível';end if;
 begin perform public.save_professional_unit_customer(o,c,'QA indevido','67999991234');raise exception 'Edição de outra filial permitida';exception when insufficient_privilege then null;end;
 begin perform public.set_professional_unit_service_link(o,s,true);raise exception 'Vínculo de outra filial permitido';exception when insufficient_privilege then null;end;
 begin perform public.create_professional_unit_appointment(o,c,s,v);raise exception 'Agendamento cruzado permitido';exception when insufficient_privilege then null;end;
 c2:=(public.save_professional_unit_customer(o,null,'QA Filial Cliente','67999991235')->>'id')::uuid;
 s2:=public.save_professional_unit_service(o,null,'QA Filial Serviço','QA',30,40);
 a2:=(public.create_professional_unit_appointment(o,c2,s2,v)->>'id')::uuid;
 if a2 is null then raise exception 'Agendamento próprio não criado';end if;
 begin perform public.list_professional_unit_customers(other_org,0);raise exception 'Outro salão acessível';exception when insufficient_privilege then null;end;
 -- Profissional fixo não pode ampliar sua unidade por parâmetro.
 begin perform public.list_professional_unit_customers_at_branch(o,b,0);raise exception 'Unidade fixa cruzada';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.professionals set branch_id=null,additional_branch_ids=array[b2] where org_id=o and id=p;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from public.list_professional_unit_customers_at_branch(o,b,0) where id=c) then raise exception 'Matriz autorizada não encontrada';end if;
 if exists(select 1 from public.list_professional_unit_customers_at_branch(o,b2,0) where id=c) then raise exception 'Cliente fora da unidade';end if;
 if not exists(select 1 from public.list_professional_unit_customers_at_branch(o,b2,0) where id=c2) then raise exception 'Filial autorizada indisponível';end if;
 begin perform public.list_professional_unit_customers_at_branch(o,b3,0);raise exception 'Filial não atribuída';exception when insufficient_privilege then null;end;
 multi_customer:=(public.save_professional_unit_customer_at_branch(o,b2,null,'QA multi cliente','67999991236')->>'id')::uuid;
 multi_service:=public.save_professional_unit_service_at_branch(o,b2,null,'QA multi serviço','QA',30,40);
 if not exists(select 1 from public.list_professional_unit_services_at_branch(o,b2,0) where id=multi_service and linked and editable) then raise exception 'Serviço multi indisponível';end if;
 if exists(select 1 from public.list_professional_unit_services_at_branch(o,b,0) where id=multi_service) then raise exception 'Serviço multi cruzado';end if;
 begin perform public.set_professional_unit_service_link_at_branch(o,b,multi_service,false);raise exception 'Vínculo cruzado';exception when insufficient_privilege then null;end;
 begin perform public.create_professional_unit_appointment_at_branch(o,b,multi_customer,multi_service,v+interval '2 hours');raise exception 'Agendamento cruzado';exception when insufficient_privilege then null;end;
 begin perform public.create_professional_unit_appointment_at_branch(o,b2,multi_customer,multi_service,v);raise exception 'Conflito entre filiais permitido';exception when exclusion_violation then null;end;
 multi_appt:=(public.create_professional_unit_appointment_at_branch(o,b2,multi_customer,multi_service,v+interval '2 hours')->>'id')::uuid;
 begin perform public.professional_attendance_action_at_branch(o,b,multi_appt,'start');raise exception 'Atendimento na filial errada';exception when insufficient_privilege then null;end;
 r:=public.professional_attendance_action_at_branch(o,b2,multi_appt,'start');
 if r->>'status' is distinct from 'in_progress' then raise exception 'Atendimento multi não iniciado';end if;
 r:=public.professional_attendance_action_at_branch(o,b2,multi_appt,'finish');
 if r->>'status' is distinct from 'completed' then raise exception 'Atendimento multi não finalizado';end if;
 execute 'reset role';
 if not exists(select 1 from public.appointments where id=multi_appt and branch_id=b2 and status='completed') then raise exception 'Unidade da agenda incorreta';end if;
end $qa$;
select 'QA operações profissionais por unidade explícita aprovadas' as resultado;
rollback;