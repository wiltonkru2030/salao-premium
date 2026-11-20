
alter table public.audit_events drop constraint if exists audit_events_org_id_fkey;
alter table public.recycle_bin drop constraint if exists recycle_bin_org_id_fkey;

comment on table public.audit_events is
  'Trilha permanente de auditoria do SALÃO PREMIUM. Guarda ator, função, tabela, identificador, operação, descrição, data/hora e valores anteriores/posteriores.';
comment on table public.recycle_bin is
  'Lixeira do SALÃO PREMIUM. Guarda snapshots integrais de linhas excluídas por até 30 dias, agrupadas pela transação original para recuperação de dependências.';
comment on column public.audit_events.occurred_at is 'Timestamp do banco de dados, em UTC, da operação auditada.';
comment on column public.recycle_bin.expires_at is 'Data/hora limite de retenção. Snapshots expirados são removidos por rotina agendada.';
comment on column public.recycle_bin.delete_group is 'Identificador para restaurar ou remover em conjunto os registros excluídos na mesma operação/transação.';

create or replace function private.purge_expired_recycle_bin()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare removed_rows integer:=0; scrubbed_rows integer:=0;
begin
  delete from public.recycle_bin where expires_at<=clock_timestamp();
  get diagnostics removed_rows=row_count;
  update public.audit_events
     set before_data=null
   where action='DELETE' and occurred_at<clock_timestamp()-interval '30 days'
     and before_data is not null;
  get diagnostics scrubbed_rows=row_count;
  return jsonb_build_object('recycle_rows_removed',removed_rows,'audit_delete_snapshots_scrubbed',scrubbed_rows);
end;
$$;
revoke all on function private.purge_expired_recycle_bin() from public,anon,authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'salao-premium-recycle-retention',
  '15 3 * * *',
  'select private.purge_expired_recycle_bin();'
);
