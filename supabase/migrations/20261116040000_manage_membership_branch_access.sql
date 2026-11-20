-- 20261116040000_manage_membership_branch_access
-- Atualização transacional das filiais atribuídas a um membro.
-- A função só pode ser executada por owner/admin da mesma organização.

CREATE OR REPLACE FUNCTION public.set_org_membership_branch_access(
  p_org_id uuid,
  p_target_user_id uuid,
  p_branch_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_membership_id uuid;
  v_target_role text;
  v_branch_ids uuid[] := coalesce(p_branch_ids, ARRAY[]::uuid[]);
  v_distinct_count integer;
  v_saved_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.';
  END IF;

  IF NOT private.has_org_role(p_org_id, ARRAY['owner','admin']::text[]) THEN
    RAISE EXCEPTION 'Somente proprietários e administradores podem atribuir filiais.';
  END IF;

  SELECT m.id, m.role
    INTO v_membership_id, v_target_role
  FROM public.org_memberships m
  WHERE m.org_id = p_org_id
    AND m.user_id = p_target_user_id
  FOR UPDATE;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado nesta organização.';
  END IF;

  IF v_target_role IN ('owner','admin') THEN
    RAISE EXCEPTION 'Proprietários e administradores possuem acesso global e não recebem restrições por filial.';
  END IF;

  SELECT count(*) INTO v_distinct_count
  FROM (
    SELECT DISTINCT requested_branch_id
    FROM unnest(v_branch_ids) AS requested(requested_branch_id)
  ) distinct_branches;

  IF cardinality(v_branch_ids) <> v_distinct_count THEN
    RAISE EXCEPTION 'A lista contém filiais repetidas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_branch_ids) AS requested(branch_id)
    WHERE requested.branch_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.branches b
        WHERE b.org_id = p_org_id
          AND b.id = requested.branch_id
          AND b.active = true
      )
  ) THEN
    RAISE EXCEPTION 'Uma ou mais filiais não pertencem à organização ou estão inativas.';
  END IF;

  DELETE FROM public.org_membership_branch_access a
  WHERE a.org_id = p_org_id
    AND a.membership_id = v_membership_id;

  INSERT INTO public.org_membership_branch_access(
    org_id, membership_id, branch_id, created_by
  )
  SELECT p_org_id, v_membership_id, requested.branch_id, (SELECT auth.uid())
  FROM unnest(v_branch_ids) AS requested(branch_id);

  GET DIAGNOSTICS v_saved_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'membership_id', v_membership_id,
    'target_user_id', p_target_user_id,
    'branch_count', v_saved_count,
    'has_access', v_saved_count > 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_org_membership_branch_access(uuid, uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_org_membership_branch_access(uuid, uuid, uuid[])
  TO authenticated;

COMMENT ON FUNCTION public.set_org_membership_branch_access(uuid, uuid, uuid[]) IS
  'Substitui atomicamente as unidades autorizadas de um membro. Array vazio remove o acesso operacional; NULL dentro do array representa a matriz.';
