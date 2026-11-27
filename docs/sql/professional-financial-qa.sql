-- QA SOMENTE: fluxo financeiro com contas sintéticas. Nunca executar em produção.
-- Reverte todos os registros; valida centavos, estoque, comissões e repasse.
begin;
do $qa$
declare
 u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); admin_user uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); product_id uuid:=gen_random_uuid();
 c uuid; s uuid; a uuid; ord uuid; item_key uuid; r jsonb; ord2 uuid; s2 uuid; a2 uuid; ids uuid[]; cents numeric; payout uuid; blocked boolean:=false;
 v timestamp:=(current_date+2)+time '10:00';
begin
 insert into auth.users(id,email) values(u,'qa-'||u||'@example.invalid');
 insert into auth.users(id,email) values(admin_user,'qa-'||admin_user||'@example.invalid');
 insert into public.profiles(id,full_name) values(admin_user,'QA Admin') on conflict(id) do nothing;
 insert into public.profiles(id,full_name) values(u,'QA fictício') on conflict(id) do nothing;
 insert into public.organizations(id,name,timezone)
 values(o,'QA fictício','America/Campo_Grande'),(other_org,'QA outro','America/Campo_Grande');
 insert into public.branches(id,org_id,name,is_main) values(b,o,'QA unidade',true);
 insert into public.org_memberships(org_id,user_id,role,status) values(o,u,'professional','active');
 insert into public.org_memberships(org_id,user_id,role,status) values(o,admin_user,'owner','active');
 insert into public.app_settings(org_id,branch_id,setting_key,setting_value) values(o,b,'product_commission','{"enabled":true,"default_rate":10}');
 insert into public.professionals(id,org_id,branch_id,profile_id,name,active,access_enabled,can_edit_own_orders,commission_rate)
 values(p,o,b,u,'QA fictício',true,true,true,50);
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

 -- Atendimento e comanda, sem receber pagamento.
 r:=public.professional_attendance_action(o,a,'start');
 ord:=(r->>'order_id')::uuid;
 if ord is null or r->>'status' is distinct from 'in_progress' then raise exception 'Falha iniciar'; end if;
 if (public.professional_attendance_action(o,a,'start')->>'order_id')::uuid is distinct from ord
 then raise exception 'Duplicação'; end if;
 perform public.professional_order_action(o,b,ord,'product',jsonb_build_object('product',product_id));

 perform public.professional_attendance_action(o,a,'finish');
 begin
  perform public.register_service_order_payment(ord,25,'pix');
  raise exception 'Profissional recebeu sem autorização';
 exception when insufficient_privilege then null; end;
 -- Segundo atendimento para regressão de centavos e repasse.
 s2:=public.save_professional_unit_service(o,null,'QA Centavos','QA',30,0.02);
 a2:=(public.create_professional_unit_appointment(o,c,s2,v+interval '1 hour')->>'id')::uuid;
 ord2:=(public.professional_attendance_action(o,a2,'start')->>'order_id')::uuid;
 perform public.professional_attendance_action(o,a2,'finish');
 -- Caixa operado por proprietário fictício.
 perform set_config('request.jwt.claim.sub',admin_user::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
 perform public.open_cash_register_for_branch(o,b,100);
 r:=public.register_service_order_payment(ord,25,'pix');
 if (r->>'balance')::numeric is distinct from 45 or (r->>'closed')::boolean is distinct from false then raise exception 'Parcial incorreto'; end if;
 if (select stock_quantity from public.products where id=product_id) is distinct from 10 then raise exception 'Estoque baixado antes da quitação'; end if;
 if (select sum(amount) from public.commissions where org_id=o and item_type='service') is distinct from 8.93 then raise exception 'Comissão serviço parcial'; end if;
 if (select sum(amount) from public.commissions where org_id=o and item_type='product') is distinct from 0.71 then raise exception 'Comissão produto parcial'; end if;
 r:=public.register_service_order_payment(ord,45,'cash');
 if (r->>'balance')::numeric is distinct from 0 or (r->>'closed')::boolean is distinct from true then raise exception 'Quitação incorreta'; end if;
 if (select stock_quantity from public.products where id=product_id) is distinct from 9 then raise exception 'Baixa estoque incorreta'; end if;
 if (select sum(amount) from public.commissions where org_id=o) is distinct from 27 then raise exception 'Comissão total incorreta';end if;
 if (select sum(amount) from public.cash_movements where org_id=o and service_order_id=ord and movement_type='income') is distinct from 70 then raise exception 'Caixa divergente';end if;
 r:=public.refund_service_order(ord,true,'QA devolução');
 if (r->>'refunded_amount')::numeric is distinct from 70 then raise exception 'Devolução incorreta';end if;
 if (select stock_quantity from public.products where id=product_id) is distinct from 10 then raise exception 'Estoque não devolvido'; end if;
 if exists(select 1 from public.commissions where org_id=o and status<>'cancelled') then raise exception 'Comissão não cancelada'; end if;
 if (select sum(amount) from public.cash_movements where org_id=o and service_order_id=ord and movement_type='expense') is distinct from 70 then raise exception 'Saída caixa incorreta';end if;
 -- Dois recebimentos de 1 centavo: comissão acumulada deve ser exatamente 1 centavo.
 perform public.register_service_order_payment(ord2,0.01,'pix');
 perform public.register_service_order_payment(ord2,0.01,'cash');
 select sum(amount),array_agg(id) into cents,ids from public.commissions where org_id=o and status='pending';
 if cents is distinct from 0.01 then raise exception 'Regressão de arredondamento: %',cents;end if;
 r:=public.pay_professional_commissions(o,p,ids,'pix','QA repasse');
 payout:=(r->>'payout_id')::uuid;
 if payout is null or (r->>'amount')::numeric is distinct from cents then raise exception 'Repasse incorreto';end if;
 if not exists(select 1 from public.cash_movements where org_id=o and id=(r->>'cash_movement_id')::uuid and movement_type='expense' and amount=cents) then raise exception 'Saída não registrada';end if;
 if exists(select 1 from public.commissions where org_id=o and status not in ('paid','cancelled')) then raise exception 'Comissão não paga';end if;
 begin perform public.refund_service_order(ord2,true,'QA após repasse');exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Devolução após repasse não bloqueada';end if;
 execute 'reset role';
 if not exists(select 1 from private.professional_notifications where org_id=o and payout_id=payout and kind='commission_paid') then raise exception 'Aviso repasse ausente';end if;
end $qa$;
select 'QA financeiro integrado aprovado' as resultado;
rollback;