-- SALÃO PREMIUM — acesso mínimo ao schema privado para RPCs públicas de leitura.
-- A camada pública usa wrappers SECURITY INVOKER. Para anon executar esses wrappers,
-- o PostgreSQL exige USAGE no schema private e EXECUTE nas funções privadas chamadas.
-- Esta migration revoga EXECUTE herdado de PUBLIC em todas as funções privadas,
-- preserva explicitamente o acesso authenticated que já existia e libera anon
-- somente para as três consultas públicas de diretório/catálogo/horários.
-- Funções de escrita e dados operacionais permanecem inacessíveis a anon.

begin;

do $block$
declare
  v_function record;
  v_signature text;
  v_authenticated_had_execute boolean;
begin
  for v_function in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.prokind in ('f','p')
  loop
    v_signature := v_function.oid::regprocedure::text;
    v_authenticated_had_execute := has_function_privilege('authenticated',v_function.oid,'EXECUTE');

    execute format('revoke execute on function %s from public, anon',v_signature);

    -- Não reduz permissões já efetivas da equipe autenticada nesta mudança de schema.
    if v_authenticated_had_execute then
      execute format('grant execute on function %s to authenticated',v_signature);
    end if;
  end loop;
end;
$block$;

grant usage on schema private to anon, authenticated;

grant execute on function private.search_public_salons(
  text,text,text,double precision,double precision,double precision,integer
) to anon;
grant execute on function private.get_public_salon_catalog(text,uuid) to anon;
grant execute on function private.get_customer_available_slots(uuid,uuid,uuid,date,uuid,integer) to anon;

commit;
