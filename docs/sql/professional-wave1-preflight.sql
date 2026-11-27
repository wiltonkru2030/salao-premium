-- Pré-verificação SOMENTE LEITURA para a primeira onda de publicação profissional.
-- Executar em QA e produção e comparar os resultados; não aplica migrations.
-- Não retorna dados de clientes, profissionais, credenciais ou corpos de funções.
with required_columns(table_name,column_name) as (
 values ('organizations','timezone'),('branches','active'),('branches','org_id'),
 ('professionals','branch_id'),('professionals','profile_id'),('professionals','access_enabled'),
 ('customers','org_id'),('customers','branch_id'),('customers','active'),('customers','phone'),
 ('services','org_id'),('services','branch_id'),('services','archived_at'),('services','active'),
 ('services','duration_minutes'),('services','price'),('professional_services','professional_id'),
 ('professional_services','service_id'),('professional_services','org_id'),
 ('appointments','org_id'),('appointments','branch_id'),('appointments','customer_id'),
 ('appointments','professional_id'),('appointments','service_id'),('appointments','starts_at'),
 ('appointments','ends_at'),('appointments','price'),('appointments','booking_source'),('appointments','created_by')
), checks as (
 select 'coluna'::text as category,r.table_name||'.'||r.column_name as item,
 exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name) as present
 from required_columns r
 union all
 select 'função', 'private.current_professional_id(uuid)', to_regprocedure('private.current_professional_id(uuid)') is not null
 union all
 select 'gatilho', 'appointments: validação de disponibilidade', exists(
 select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid=to_regclass('public.appointments') and not t.tgisinternal and t.tgenabled in ('O','A') and p.proname='prevent_appointment_overlap')
 union all
 select 'chave única', r.table_name||'(org_id,id)', exists(
 select 1 from pg_constraint co where co.conrelid=to_regclass('public.'||r.table_name) and co.contype in ('p','u')
 and (select array_agg(a.attname::text order by a.attname::text) from unnest(co.conkey) k(attnum) join pg_attribute a on a.attrelid=co.conrelid and a.attnum=k.attnum)=array['id','org_id']::text[])
 from (values ('services'),('professionals')) r(table_name)
 union all
 select 'RLS',r.table_name,coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||r.table_name)),false)
 from (values ('customers'),('services'),('professional_services'),('appointments'),('professionals'),('branches')) r(table_name)
)
select category,item,present from checks order by category,item;
