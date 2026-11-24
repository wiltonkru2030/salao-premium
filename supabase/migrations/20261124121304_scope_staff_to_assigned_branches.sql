-- Atribuições de unidades da SEG-02. O vínculo organizacional mantém o papel.
-- A tabela permite preparar atribuições antes de ativar o escopo nos módulos.
-- Usa as chaves compostas de branches e org_memberships e auth.uid() nas políticas.
begin;

create table public.branch_memberships (
  org_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (org_id, branch_id, user_id),
  foreign key (org_id, branch_id) references public.branches(org_id, id) on delete cascade,
  foreign key (org_id, user_id) references public.org_memberships(org_id, user_id) on delete cascade
);

create index branch_memberships_org_user_idx on public.branch_memberships (org_id, user_id);
create index branch_memberships_created_by_idx on public.branch_memberships (created_by);

alter table public.branch_memberships enable row level security;
revoke all on public.branch_memberships from public, anon, authenticated;
grant select, delete on public.branch_memberships to authenticated;
grant insert (org_id, branch_id, user_id) on public.branch_memberships to authenticated;

create policy branch_memberships_select on public.branch_memberships
for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin'])
  or (user_id = (select auth.uid()) and private.has_org_role(org_id, array['manager','receptionist']))
);

create policy branch_memberships_insert on public.branch_memberships
for insert to authenticated
with check (private.has_org_role(org_id, array['owner','admin']));

create policy branch_memberships_delete on public.branch_memberships
for delete to authenticated
using (private.has_org_role(org_id, array['owner','admin']));

-- Autoriza o escopo de gestão da unidade. O chamador deve validar a permissão da operação.
-- Para gerente e recepção exige vínculo ativo com a organização e unidade ativa atribuída.
-- Proprietário e administrador conservam o escopo global, inclusive operações centrais.
-- A função privada usa auth.uid() explicitamente para poder compor políticas de branches sem recursão.
create function private.has_staff_branch_scope(target_org uuid, target_branch uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select private.has_org_role(target_org, array['owner','admin'])
     or exists (
       select 1 from public.branch_memberships membership
       join public.branches branch
         on branch.org_id = membership.org_id and branch.id = membership.branch_id
       where membership.org_id = target_org
         and membership.branch_id = target_branch
         and membership.user_id = (select auth.uid())
         and branch.active
         and private.has_org_role(target_org, array['manager','receptionist'])
     );
$function$;

revoke all on function private.has_staff_branch_scope(uuid, uuid) from public, anon, authenticated;
grant execute on function private.has_staff_branch_scope(uuid, uuid) to authenticated;

commit;
