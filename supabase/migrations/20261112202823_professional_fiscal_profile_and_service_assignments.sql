alter table public.professionals
  add column if not exists tax_regime text not null default 'individual',
  add column if not exists cnpj text,
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists specialty text;

alter table public.professionals
  drop constraint if exists professionals_tax_regime_check;
alter table public.professionals
  add constraint professionals_tax_regime_check
  check (tax_regime in ('individual','mei'));

alter table public.professionals
  drop constraint if exists professionals_mei_cnpj_check;
alter table public.professionals
  add constraint professionals_mei_cnpj_check
  check (tax_regime <> 'mei' or (cnpj is not null and length(regexp_replace(cnpj, '[^0-9]', '', 'g')) = 14));

create table if not exists public.professional_services (
  org_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (org_id, professional_id, service_id),
  constraint professional_services_professional_fk
    foreign key (org_id, professional_id) references public.professionals(org_id, id) on delete cascade,
  constraint professional_services_service_fk
    foreign key (org_id, service_id) references public.services(org_id, id) on delete cascade
);

create index if not exists professional_services_service_idx
  on public.professional_services(org_id, service_id);

alter table public.professional_services enable row level security;

grant select, insert, delete on public.professional_services to authenticated;

drop policy if exists professional_services_select_scoped on public.professional_services;
create policy professional_services_select_scoped
on public.professional_services for select to authenticated
using (
  private.has_org_role(org_id, array['owner','admin','manager','receptionist'])
  or professional_id = private.current_professional_id(org_id)
  or private.professional_app_scope(org_id) = any(array['calendar_all','all'])
);

drop policy if exists professional_services_manage_admin on public.professional_services;
create policy professional_services_manage_admin
on public.professional_services for all to authenticated
using (private.is_org_admin(org_id))
with check (private.is_org_admin(org_id));
