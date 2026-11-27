-- QA somente. Contas fictícias; a transação é sempre revertida.
begin;
do $qa$
declare
 o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid();
 owner_id uuid:=gen_random_uuid(); mgr uuid:=gen_random_uuid(); rec uuid:=gen_random_uuid();
 c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); central uuid:=gen_random_uuid();
 r1 uuid; r2 uuid; r jsonb; n integer; blocked boolean;
begin
 insert into auth.users(id,email) values(owner_id,'qa-'||owner_id||'@example.invalid'),(mgr,'qa-'||mgr||'@example.invalid'),(rec,'qa-'||rec||'@example.invalid');
 insert into public.profiles(id,full_name) values(owner_id,'QA proprietário'),(mgr,'QA gerente'),(rec,'QA recepção') on conflict(id) do nothing;
 insert into public.organizations(id,name,timezone) values(o,'QA escopo funcionários','America/Campo_Grande');
 insert into public.branches(id,org_id,name,is_main) values(b,o,'QA Matriz',true),(b2,o,'QA Filial',false);
 insert into public.org_memberships(org_id,user_id,role,status) values(o,owner_id,'owner','active'),(o,mgr,'manager','active'),(o,rec,'receptionist','active');
 insert into public.customers(id,org_id,branch_id,name,phone) values(c1,o,b,'QA matriz','67999991234'),(c2,o,b2,'QA filial','67999991235'),(central,o,null,'QA central','67999991236');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 -- Proprietário pode atribuir unidades e consultar o cadastro central.
 insert into public.branch_memberships(org_id,branch_id,user_id) values(o,b,mgr),(o,b2,rec);
 if (select count(*) from public.customers where org_id=o)<>3 then raise exception 'Proprietário perdeu carteira';end if;
 r:=public.open_cash_register_for_branch(o,b,100);r1:=(r->>'cash_register_id')::uuid;
 r:=public.open_cash_register_for_branch(o,b2,200);r2:=(r->>'cash_register_id')::uuid;
 if r1 is null or r2 is null then raise exception 'Caixas não criados';end if;
 -- Gerente vê só a matriz, inclusive por RPC privilegiada.
 perform set_config('request.jwt.claim.sub',mgr::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',mgr,'role','authenticated')::text,true);
 if (select count(*) from public.branches where org_id=o)<>1 or not exists(select 1 from public.branches where id=b) then raise exception 'Unidade gerente';end if;
 if (select count(*) from public.customers where org_id=o)<>1 or not exists(select 1 from public.customers where id=c1) then raise exception 'Carteira gerente';end if;
 update public.customers set name='QA permitido' where id=c1;
 get diagnostics n=row_count;if n<>1 then raise exception 'Edição própria gerente';end if;
 update public.customers set name='QA indevido' where id=c2;
 get diagnostics n=row_count;if n<>0 then raise exception 'Edição cruzada gerente';end if;
 begin update public.customers set branch_id=b2 where id=c1;raise exception 'Transferência indevida';exception when insufficient_privilege then null;end;
 begin insert into public.branch_memberships(org_id,branch_id,user_id) values(o,b2,mgr);raise exception 'Autoatribuição indevida';exception when insufficient_privilege then null;end;
 if (public.get_cash_register_summary(r1)->>'expected_cash')::numeric is distinct from 100 then raise exception 'Resumo próprio';end if;
 blocked:=false;begin perform public.get_cash_register_summary(r2);exception when raise_exception or insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Resumo cruzado';end if;
 blocked:=false;begin perform public.close_cash_register(r2,200);exception when raise_exception or insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Fechamento cruzado';end if;
 -- Recepção vê somente a filial e não pode consultar caixa da matriz.
 perform set_config('request.jwt.claim.sub',rec::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',rec,'role','authenticated')::text,true);
 if (select count(*) from public.branches where org_id=o)<>1 or not exists(select 1 from public.branches where id=b2) then raise exception 'Unidade recepção';end if;
 if (select count(*) from public.customers where org_id=o)<>1 or not exists(select 1 from public.customers where id=c2) then raise exception 'Carteira recepção';end if;
 if (public.get_cash_register_summary(r2)->>'expected_cash')::numeric is distinct from 200 then raise exception 'Resumo recepção';end if;
 blocked:=false;begin perform public.get_cash_register_summary(r1);exception when raise_exception or insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Resumo cruzado recepção';end if;
 -- Revogação da unidade é efetiva mesmo com as mesmas claims.
 execute 'reset role';
 delete from public.branch_memberships where org_id=o and branch_id=b2 and user_id=rec;
 execute 'set local role authenticated';
 if exists(select 1 from public.branches where org_id=o) or exists(select 1 from public.customers where org_id=o) then raise exception 'Revogação não efetiva';end if;
 blocked:=false;begin perform public.get_cash_register_summary(r2);exception when raise_exception or insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Caixa acessível após revogação';end if;
 execute 'reset role';
 if (select count(*) from public.cash_registers where org_id=o and status='open')<>2 then raise exception 'Fechamento indevido';end if;
end $qa$;
select 'QA escopo de gerente, recepção, proprietário e Caixa aprovado' as resultado;
rollback;
