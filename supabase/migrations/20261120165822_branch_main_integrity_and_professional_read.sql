-- Proteção da matriz e leitura da unidade vinculada ao profissional autenticado.
create unique index if not exists branches_single_main_per_org_idx on public.branches(org_id) where is_main;
do $block$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.branches'::regclass and conname='branches_main_must_be_active') then
  alter table public.branches add constraint branches_main_must_be_active check (not is_main or active);
 end if;
end;
$block$;
drop policy if exists branches_select_staff on public.branches;
create policy branches_select_staff on public.branches for select to authenticated
using (
 private.has_org_role(org_id,array['owner','admin','manager','receptionist','finance','viewer'])
 or exists(select 1 from public.professionals p where p.org_id=branches.org_id and p.id=private.current_professional_id(branches.org_id) and p.branch_id=branches.id)
);
