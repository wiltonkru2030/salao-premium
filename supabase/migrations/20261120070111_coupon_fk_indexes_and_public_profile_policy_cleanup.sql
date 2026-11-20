-- SALÃO PREMIUM — índices de integridade e políticas RLS sem sobreposição.
-- Responsabilidade:
--   - Cobrir chaves estrangeiras introduzidas no módulo de cupons.
--   - Evitar políticas SELECT permissivas duplicadas nas configurações da vitrine.
-- Segurança: leitura da vitrine para membros ativos; INSERT/UPDATE/DELETE somente owner/admin.

begin;

create index if not exists salon_coupons_org_branch_fk_idx
  on public.salon_coupons(org_id,branch_id);

create index if not exists salon_coupon_services_org_coupon_fk_idx
  on public.salon_coupon_services(org_id,coupon_id);

create index if not exists salon_coupon_services_org_service_fk_idx
  on public.salon_coupon_services(org_id,service_id);

create index if not exists customer_coupon_redemptions_org_coupon_user_status_idx
  on public.customer_coupon_redemptions(org_id,coupon_id,auth_user_id,status);

create index if not exists customer_coupon_redemptions_auth_user_fk_idx
  on public.customer_coupon_redemptions(auth_user_id);

-- A política FOR ALL anterior também valia para SELECT e se sobrepunha à leitura
-- para membros. Separar operações mantém uma única política de SELECT por tabela.
drop policy if exists salon_public_profiles_admin_manage on public.salon_public_profiles;
drop policy if exists salon_public_profiles_admin_insert on public.salon_public_profiles;
drop policy if exists salon_public_profiles_admin_update on public.salon_public_profiles;
drop policy if exists salon_public_profiles_admin_delete on public.salon_public_profiles;

create policy salon_public_profiles_admin_insert
  on public.salon_public_profiles for insert to authenticated
  with check ((select private.has_org_role(org_id,array['owner','admin']::text[])));

create policy salon_public_profiles_admin_update
  on public.salon_public_profiles for update to authenticated
  using ((select private.has_org_role(org_id,array['owner','admin']::text[])))
  with check ((select private.has_org_role(org_id,array['owner','admin']::text[])));

create policy salon_public_profiles_admin_delete
  on public.salon_public_profiles for delete to authenticated
  using ((select private.has_org_role(org_id,array['owner','admin']::text[])));

drop policy if exists branch_public_profiles_admin_manage on public.branch_public_profiles;
drop policy if exists branch_public_profiles_admin_insert on public.branch_public_profiles;
drop policy if exists branch_public_profiles_admin_update on public.branch_public_profiles;
drop policy if exists branch_public_profiles_admin_delete on public.branch_public_profiles;

create policy branch_public_profiles_admin_insert
  on public.branch_public_profiles for insert to authenticated
  with check ((select private.has_org_role(org_id,array['owner','admin']::text[])));

create policy branch_public_profiles_admin_update
  on public.branch_public_profiles for update to authenticated
  using ((select private.has_org_role(org_id,array['owner','admin']::text[])))
  with check ((select private.has_org_role(org_id,array['owner','admin']::text[])));

create policy branch_public_profiles_admin_delete
  on public.branch_public_profiles for delete to authenticated
  using ((select private.has_org_role(org_id,array['owner','admin']::text[])));

commit;
