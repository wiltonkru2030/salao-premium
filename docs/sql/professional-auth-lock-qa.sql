begin;
do $qa$
declare k text:='user:'||gen_random_uuid()::text; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
begin
 execute 'set local role authenticated';
 begin perform public.acquire_professional_auth_lock(k,a);raise exception 'Lock público';exception when insufficient_privilege then null;end;
 execute 'reset role';
 execute 'set local role service_role';
 if not public.acquire_professional_auth_lock(k,a) then raise exception 'Lock inicial';end if;
 if public.acquire_professional_auth_lock(k,b) then raise exception 'Lock duplicado';end if;
 if public.release_professional_auth_lock(k,b) then raise exception 'Liberação alheia';end if;
 if not public.release_professional_auth_lock(k,a) then raise exception 'Liberação';end if;
 if not public.acquire_professional_auth_lock(k,b) then raise exception 'Novo lock';end if;
 execute 'reset role';
end $qa$;
select 'QA bloqueio de operações Auth aprovado' as resultado;
rollback;