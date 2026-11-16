-- 20261116030000_enforce_branch_access_rls
-- Impõe o escopo de unidade como política RESTRICTIVE: as políticas permissivas
-- existentes continuam definindo QUAIS operações cada papel pode fazer, enquanto
-- esta camada exige também atribuição explícita à unidade.
-- Pré-requisitos: 20261116010000_scope_cash_and_commissions_by_branch.sql
--                20261116020000_branch_membership_access_foundation.sql
-- Não executar manualmente no Supabase de produção.

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'app_settings',
    'appointment_blocks',
    'appointment_groups',
    'appointments',
    'cash_movements',
    'cash_registers',
    'commission_payouts',
    'commissions',
    'customers',
    'expenses',
    'inventory_movements',
    'products',
    'professionals',
    'quotes',
    'sales',
    'service_order_payments',
    'service_orders'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS branch_access_guard ON public.%I',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY branch_access_guard ON public.%I AS RESTRICTIVE
       FOR ALL TO authenticated
       USING (private.has_branch_access(org_id, branch_id))
       WITH CHECK (private.has_branch_access(org_id, branch_id))',
      v_table
    );
  END LOOP;
END;
$$;

-- A própria listagem de filiais também deve respeitar a atribuição.
DROP POLICY IF EXISTS branch_access_guard ON public.branches;
CREATE POLICY branch_access_guard
  ON public.branches AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (private.has_branch_access(org_id, id))
  WITH CHECK (private.has_branch_access(org_id, id));

-- Tabelas filhas sem branch_id herdam a autorização da entidade-pai.
DROP POLICY IF EXISTS branch_access_guard ON public.appointment_group_items;
CREATE POLICY branch_access_guard
  ON public.appointment_group_items AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointment_groups parent
      WHERE parent.org_id = appointment_group_items.org_id
        AND parent.id = appointment_group_items.appointment_group_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.appointment_groups parent
      WHERE parent.org_id = appointment_group_items.org_id
        AND parent.id = appointment_group_items.appointment_group_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  );

DROP POLICY IF EXISTS branch_access_guard ON public.quote_items;
CREATE POLICY branch_access_guard
  ON public.quote_items AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes parent
      WHERE parent.org_id = quote_items.org_id
        AND parent.id = quote_items.quote_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quotes parent
      WHERE parent.org_id = quote_items.org_id
        AND parent.id = quote_items.quote_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  );

DROP POLICY IF EXISTS branch_access_guard ON public.sale_items;
CREATE POLICY branch_access_guard
  ON public.sale_items AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales parent
      WHERE parent.org_id = sale_items.org_id
        AND parent.id = sale_items.sale_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales parent
      WHERE parent.org_id = sale_items.org_id
        AND parent.id = sale_items.sale_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  );

DROP POLICY IF EXISTS branch_access_guard ON public.service_order_items;
CREATE POLICY branch_access_guard
  ON public.service_order_items AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.service_orders parent
      WHERE parent.org_id = service_order_items.org_id
        AND parent.id = service_order_items.order_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.service_orders parent
      WHERE parent.org_id = service_order_items.org_id
        AND parent.id = service_order_items.order_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  );

DROP POLICY IF EXISTS branch_access_guard ON public.commission_payout_items;
CREATE POLICY branch_access_guard
  ON public.commission_payout_items AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.commission_payouts parent
      WHERE parent.org_id = commission_payout_items.org_id
        AND parent.id = commission_payout_items.payout_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.commission_payouts parent
      WHERE parent.org_id = commission_payout_items.org_id
        AND parent.id = commission_payout_items.payout_id
        AND private.has_branch_access(parent.org_id, parent.branch_id)
    )
  );

COMMENT ON POLICY branch_access_guard ON public.appointments IS
  'Restringe leitura e escrita à matriz ou filial explicitamente atribuída; owner/admin ativos mantêm acesso global.';
