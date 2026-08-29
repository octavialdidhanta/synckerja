-- Sync POS staff verified_at from completed magic_links (org-scoped)
-- Also marks legacy employees with user_id and zero magic_links as verified.

CREATE OR REPLACE FUNCTION public.pos_staff_sync_verified(p_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  WITH verified_users AS (
    SELECT DISTINCT ml.user_id
    FROM public.magic_links ml
    WHERE ml.status = 'completed'
       OR ml.email_verified = true
  ),
  legacy_users AS (
    SELECT e.user_id
    FROM public.employees e
    WHERE e.organization_id = p_organization_id
      AND e.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.magic_links ml WHERE ml.user_id = e.user_id
      )
  ),
  to_verify AS (
    SELECT s.id
    FROM public.pos_employee_staff s
    INNER JOIN public.employees e
      ON e.id = s.employee_id
     AND e.organization_id = s.organization_id
    WHERE s.organization_id = p_organization_id
      AND s.verified_at IS NULL
      AND e.user_id IS NOT NULL
      AND (
        e.user_id IN (SELECT user_id FROM verified_users)
        OR e.user_id IN (SELECT user_id FROM legacy_users)
      )
  )
  UPDATE public.pos_employee_staff s
  SET
    verified_at = now(),
    updated_at = now()
  FROM to_verify t
  WHERE s.id = t.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_sync_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_sync_verified(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_staff_is_user_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.magic_links ml
    WHERE ml.user_id = p_user_id
      AND (ml.status = 'completed' OR ml.email_verified = true)
  ) THEN
    RETURN true;
  END IF;
  -- Legacy / owner: has auth user, never used magic-link invite flow
  RETURN NOT EXISTS (
    SELECT 1 FROM public.magic_links ml WHERE ml.user_id = p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_is_user_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_is_user_verified(uuid) TO authenticated;
