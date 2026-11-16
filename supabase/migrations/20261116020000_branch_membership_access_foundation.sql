-- 20261116020000_branch_membership_access_foundation
-- Fundação de atribuição de membros a unidades.
-- IMPORTANTE: esta migration, isoladamente, NÃO ativa isolamento por filial.
-- As políticas RLS das tabelas operacionais só devem ser substituídas na etapa
-- seguinte, após testes de regressão com owner/admin, recepção, financeiro e profissional.
-- Não executar manualmente no projeto Supabase de produção.

-- Permite FK composta para impedir que uma atribuição misture tenants.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_memberships_org_id_id_key'
      AND conrelid = 'public.org_memberships'::regclass
  ) THEN
    ALTER TABLE public.org_memberships
      ADD CONSTRAINT org_memberships_org_id_id_key UNIQUE (org_id, id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.org_membership_branch_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  branch_id uuid NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_membership_branch_access_membership_fkey
    FOREIGN KEY (org_id, membership_id)
    REFERENCES public.org_memberships(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT org_membership_branch_access_branch_fkey
    FOREIGN KEY (org_id, branch_id)
    REFERENCES public.branches(org_id, id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.org_membership_branch_access IS
  'Unidades autorizadas para cada vínculo de usuário na organização. branch_id NULL representa acesso à matriz; owner/admin mantêm acesso global pela função privada.';

CREATE UNIQUE INDEX IF NOT EXISTS org_membership_branch_access_branch_unique
  ON public.org_membership_branch_access(org_id, membership_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_membership_branch_access_matrix_unique
  ON public.org_membership_branch_access(org_id, membership_id)
  WHERE branch_id IS NULL;

CREATE INDEX IF NOT EXISTS org_membership_branch_access_member_idx
  ON public.org_membership_branch_access(org_id, membership_id);

-- Compatibilidade no rollout: os membros ativos já existentes começam com
-- as mesmas unidades atualmente visíveis para a organização. O administrador
-- deve revisar e reduzir essas atribuições pela tela Equipe antes de declarar
-- o isolamento por unidade homologado. Novos membros não recebem acesso
-- automaticamente e precisam ser atribuídos explicitamente.
INSERT INTO public.org_membership_branch_access(
  org_id, membership_id, branch_id, created_by
)
SELECT
  m.org_id,
  m.id,
  CASE WHEN b.is_main THEN NULL::uuid ELSE b.id END,
  NULL::uuid
FROM public.org_memberships m
JOIN public.branches b
  ON b.org_id = m.org_id
 AND b.active = true
WHERE m.status = 'active'
  AND m.role NOT IN ('owner','admin')
ON CONFLICT DO NOTHING;

ALTER TABLE public.org_membership_branch_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_branch_access_select_self_or_admin
  ON public.org_membership_branch_access;
CREATE POLICY membership_branch_access_select_self_or_admin
  ON public.org_membership_branch_access
  FOR SELECT TO authenticated
  USING (
    private.has_org_role(org_id, ARRAY['owner','admin']::text[])
    OR EXISTS (
      SELECT 1
      FROM public.org_memberships m
      WHERE m.id = membership_id
        AND m.org_id = org_membership_branch_access.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
    )
  );

-- A tabela é somente leitura pelo Data API. Alterações passam exclusivamente
-- pela RPC transacional set_org_membership_branch_access.
GRANT SELECT
  ON TABLE public.org_membership_branch_access
  TO authenticated;

-- Função sem recursão de RLS: lê memberships e atribuições com privilégio
-- controlado, exige usuário autenticado e limita o resultado ao tenant informado.
CREATE OR REPLACE FUNCTION private.has_branch_access(
  target_org uuid,
  target_branch uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.org_memberships m
      WHERE m.org_id = target_org
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role = ANY(ARRAY['owner','admin']::text[])
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.org_memberships m
      JOIN public.org_membership_branch_access a
        ON a.org_id = m.org_id
       AND a.membership_id = m.id
      WHERE m.org_id = target_org
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND a.branch_id IS NOT DISTINCT FROM target_branch
    )
  END;
$function$;

REVOKE ALL ON FUNCTION private.has_branch_access(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_branch_access(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION private.has_branch_access(uuid, uuid) IS
  'Retorna true para owner/admin ativos em toda a organização; demais membros somente para a unidade explicitamente atribuída. branch_id NULL representa matriz.';
