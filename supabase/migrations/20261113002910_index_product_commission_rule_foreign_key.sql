create index if not exists commission_rules_org_product_fk_idx
  on public.commission_rules (org_id, product_id);
