-- Índices prioritários de relacionamentos e filtros operacionais.
-- Não remove índices existentes nem altera registros de negócio.
create index if not exists appointments_org_branch_starts_idx on public.appointments(org_id,branch_id,starts_at);
create index if not exists appointments_org_customer_starts_idx on public.appointments(org_id,customer_id,starts_at);
create index if not exists appointments_service_order_fk_idx on public.appointments(service_order_id);
create index if not exists appointment_blocks_org_branch_starts_idx on public.appointment_blocks(org_id,branch_id,starts_at);
create index if not exists appointment_blocks_org_professional_starts_idx on public.appointment_blocks(org_id,professional_id,starts_at);
create index if not exists appointment_holds_org_branch_idx on public.appointment_holds(org_id,branch_id);
create index if not exists appointment_holds_org_service_idx on public.appointment_holds(org_id,service_id);
create index if not exists cash_movements_org_register_created_idx on public.cash_movements(org_id,cash_register_id,created_at desc,id desc);
create index if not exists cash_movements_org_branch_created_idx on public.cash_movements(org_id,branch_id,created_at desc,id desc);
create index if not exists cash_movements_org_created_idx on public.cash_movements(org_id,created_at desc,id desc);
