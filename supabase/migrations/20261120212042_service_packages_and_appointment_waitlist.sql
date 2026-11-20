-- SALÃO PREMIUM: catálogo de combos e fila de espera por unidade.
-- Não altera Agenda/Comandas existentes e não reserva horários automaticamente.
begin;
create table public.service_packages (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id) on delete restrict,
 branch_id uuid,
 name text not null check (char_length(btrim(name)) between 2 and 120),
 description text check (description is null or char_length(description)<=1000),
 reference_price numeric(12,2) check (reference_price is null or reference_price>=0),
 active boolean not null default true,
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_id,id),
 constraint service_packages_org_branch_fk foreign key(org_id,branch_id)
  references public.branches(org_id,id)
);
create table public.service_package_items (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 package_id uuid not null,
 service_id uuid not null,
 sort_order integer not null check (sort_order between 1 and 20),
 quantity integer not null default 1 check (quantity between 1 and 20),
 pause_after_minutes integer not null default 0 check (pause_after_minutes between 0 and 720),
 created_at timestamptz not null default now(),
 unique(org_id,package_id,sort_order),
 constraint service_package_items_package_fk foreign key(org_id,package_id)
  references public.service_packages(org_id,id) on delete restrict,
 constraint service_package_items_service_fk foreign key(org_id,service_id)
  references public.services(org_id,id)
);
create table public.appointment_waitlist (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id) on delete restrict,
 branch_id uuid not null,
 customer_id uuid not null,
 service_id uuid not null,
 professional_id uuid,
 preferred_from date not null,
 preferred_until date not null,
 time_from time not null default '08:00',
 time_until time not null default '20:00',
 status text not null default 'waiting'
  check(status in ('waiting','contacted','booked','cancelled')),
 matched_appointment_id uuid,
 notes text check (notes is null or char_length(notes)<=500),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(preferred_from<=preferred_until),
 check(time_from<time_until),
 check((status='booked')=(matched_appointment_id is not null)),
 unique(org_id,id),
 constraint appointment_waitlist_branch_fk foreign key(org_id,branch_id)
  references public.branches(org_id,id),
 constraint appointment_waitlist_customer_fk foreign key(org_id,customer_id)
  references public.customers(org_id,id),
 constraint appointment_waitlist_service_fk foreign key(org_id,service_id)
  references public.services(org_id,id),
 constraint appointment_waitlist_professional_fk foreign key(org_id,professional_id)
  references public.professionals(org_id,id),
 constraint appointment_waitlist_booking_fk foreign key(org_id,matched_appointment_id)
  references public.appointments(org_id,id)
);
create unique index appointment_waitlist_active_unique on public.appointment_waitlist
 (org_id,branch_id,customer_id,service_id,coalesce(professional_id,'00000000-0000-0000-0000-000000000000'::uuid))
 where status in ('waiting','contacted');
create unique index appointment_waitlist_matched_appointment_unique on public.appointment_waitlist(matched_appointment_id)
 where matched_appointment_id is not null;
create index service_packages_scope_idx on public.service_packages(org_id,branch_id,active,name);
create index service_package_items_service_idx on public.service_package_items(org_id,service_id);
create index appointment_waitlist_lookup_idx on public.appointment_waitlist(org_id,branch_id,status,preferred_from,preferred_until,created_at);
create index appointment_waitlist_professional_idx on public.appointment_waitlist(org_id,professional_id);
create index appointment_waitlist_booking_idx on public.appointment_waitlist(org_id,matched_appointment_id);

alter table public.service_packages enable row level security;
alter table public.service_package_items enable row level security;
alter table public.appointment_waitlist enable row level security;
revoke all on public.service_packages,public.service_package_items,public.appointment_waitlist from public,anon,authenticated;
grant select on public.service_packages,public.service_package_items,public.appointment_waitlist to authenticated;
create policy service_packages_staff_read on public.service_packages for select to authenticated
 using(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));
create policy service_package_items_staff_read on public.service_package_items for select to authenticated
 using(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));
create policy appointment_waitlist_staff_read on public.appointment_waitlist for select to authenticated
 using(private.has_org_role(org_id,array['owner','admin','manager','receptionist']));

create trigger audit_row_change after insert or update or delete on public.service_packages
 for each row execute function private.capture_row_audit();
create trigger audit_row_change after insert or update or delete on public.service_package_items
 for each row execute function private.capture_row_audit();
create trigger audit_row_change after insert or update or delete on public.appointment_waitlist
 for each row execute function private.capture_row_audit();
comment on column public.service_packages.reference_price is
 'Preço informativo do combo. Não recebe pagamentos nem aplica descontos automaticamente.';
comment on column public.service_package_items.pause_after_minutes is
 'Intervalo sem reserva de profissional entre etapas. Não cria bloqueio nem libera recurso por si só.';
comment on table public.appointment_waitlist is
 'Pedido de encaixe; consulta de disponibilidade não equivale a reserva e exige confirmação na Agenda.';
commit;
