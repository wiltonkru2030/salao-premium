
alter table public.commissions add column if not exists payout_id uuid;

create table if not exists public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null,
  branch_id uuid,
  cash_register_id uuid,
  cash_movement_id uuid references public.cash_movements(id),
  amount numeric(12,2) not null check(amount>0),
  payment_method text not null check(payment_method in ('cash','pix','credit_card','debit_card','transfer','voucher','other')),
  notes text,
  paid_by uuid,
  paid_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint commission_payouts_org_id_id_key unique(org_id,id),
  constraint commission_payouts_professional_fk foreign key(org_id,professional_id) references public.professionals(org_id,id),
  constraint commission_payouts_branch_fk foreign key(org_id,branch_id) references public.branches(org_id,id),
  constraint commission_payouts_register_fk foreign key(org_id,cash_register_id) references public.cash_registers(org_id,id)
);

create table if not exists public.commission_payout_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  payout_id uuid not null,
  commission_id uuid not null references public.commissions(id),
  amount numeric(12,2) not null check(amount>=0),
  created_at timestamptz not null default clock_timestamp(),
  constraint commission_payout_items_payout_fk foreign key(org_id,payout_id) references public.commission_payouts(org_id,id) on delete cascade,
  constraint commission_payout_items_commission_unique unique(commission_id)
);

do $$
begin
  if not exists(select 1 from pg_constraint where conname='commissions_org_payout_fk') then
    alter table public.commissions add constraint commissions_org_payout_fk
      foreign key(org_id,payout_id) references public.commission_payouts(org_id,id);
  end if;
end $$;

create index if not exists commission_payouts_org_professional_paid_idx
  on public.commission_payouts(org_id,professional_id,paid_at desc);
create index if not exists commission_payout_items_org_payout_idx
  on public.commission_payout_items(org_id,payout_id);
create index if not exists commission_payouts_cash_movement_idx
  on public.commission_payouts(cash_movement_id);
create index if not exists commissions_org_professional_paid_idx
  on public.commissions(org_id,professional_id,status,created_at desc);

alter table public.commission_payouts enable row level security;
alter table public.commission_payout_items enable row level security;
drop policy if exists commission_payouts_select_scoped on public.commission_payouts;
create policy commission_payouts_select_scoped on public.commission_payouts for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager','finance'])
  or professional_id=private.current_professional_id(org_id)
);
drop policy if exists commission_payout_items_select_scoped on public.commission_payout_items;
create policy commission_payout_items_select_scoped on public.commission_payout_items for select to authenticated
using (
  private.has_org_role(org_id,array['owner','admin','manager','finance'])
  or exists(
    select 1 from public.commissions c
    where c.org_id=commission_payout_items.org_id
      and c.id=commission_payout_items.commission_id
      and c.professional_id=private.current_professional_id(commission_payout_items.org_id)
  )
);
grant select on public.commission_payouts,public.commission_payout_items to authenticated;
revoke insert,update,delete on public.commission_payouts,public.commission_payout_items from anon,authenticated;

drop trigger if exists audit_row_change on public.commission_payouts;
create trigger audit_row_change after insert or update or delete on public.commission_payouts
for each row execute function private.capture_row_audit();
drop trigger if exists audit_row_change on public.commission_payout_items;
create trigger audit_row_change after insert or update or delete on public.commission_payout_items
for each row execute function private.capture_row_audit();

comment on table public.commission_payouts is 'Pagamentos realizados a profissionais, vinculados ao movimento de saída no Caixa.';
comment on table public.commission_payout_items is 'Comissões individuais incluídas em cada pagamento, preservando histórico e valores pagos.';
