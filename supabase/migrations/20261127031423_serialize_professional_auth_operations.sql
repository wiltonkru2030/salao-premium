-- Serializa alterações administrativas de senha e conclusão provisória entre chamadas Auth.
-- Sem expiração automática: se o processo morrer, suporte confere antes de liberar.
create table private.professional_auth_operation_locks(
 lock_key text primary key check(lock_key ~ '^(user|professional):[0-9a-f-]{36}$'),
 holder uuid not null, acquired_at timestamptz not null default now()
);
alter table private.professional_auth_operation_locks enable row level security;
revoke all on private.professional_auth_operation_locks from public,anon,authenticated;
create function private.acquire_professional_auth_lock(operation_key text,operation_holder uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if operation_key is null or operation_holder is null then raise exception 'Operação inválida.' using errcode='22023';end if;
 insert into private.professional_auth_operation_locks(lock_key,holder) values(operation_key,operation_holder)
 on conflict(lock_key) do nothing;
 return found;
end $$;
create function private.release_professional_auth_lock(operation_key text,operation_holder uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from private.professional_auth_operation_locks where lock_key=operation_key and holder=operation_holder;
 return found;
end $$;
create function public.acquire_professional_auth_lock(operation_key text,operation_holder uuid)
returns boolean language sql security invoker set search_path='' as $$ select private.acquire_professional_auth_lock($1,$2) $$;
create function public.release_professional_auth_lock(operation_key text,operation_holder uuid)
returns boolean language sql security invoker set search_path='' as $$ select private.release_professional_auth_lock($1,$2) $$;
revoke all on function private.acquire_professional_auth_lock(text,uuid),private.release_professional_auth_lock(text,uuid),public.acquire_professional_auth_lock(text,uuid),public.release_professional_auth_lock(text,uuid) from public,anon,authenticated;
grant execute on function private.acquire_professional_auth_lock(text,uuid),private.release_professional_auth_lock(text,uuid),public.acquire_professional_auth_lock(text,uuid),public.release_professional_auth_lock(text,uuid) to service_role;
;
