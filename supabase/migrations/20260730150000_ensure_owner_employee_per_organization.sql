-- Backfill + helper: every organization owner should have an employees row in that org.
-- Fixes empty Employee Management when user creates a 2nd organization.

CREATE OR REPLACE FUNCTION public.ensure_organization_owner_employee(
  p_organization_id uuid,
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_full_name text;
  v_email text;
  v_status_id uuid;
  v_department_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'organization_id and user_id are required';
  END IF;

  SELECT e.id
  INTO v_employee_id
  FROM public.employees e
  WHERE e.organization_id = p_organization_id
    AND e.user_id = p_user_id
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  SELECT
    COALESCE(NULLIF(btrim(p_full_name), ''), NULLIF(btrim(p.full_name), ''), 'Owner'),
    COALESCE(NULLIF(btrim(p_email), ''), NULLIF(btrim(p.email), ''), NULLIF(btrim(o.email), ''))
  INTO v_full_name, v_email
  FROM public.organizations o
  LEFT JOIN public.profiles p ON p.user_id = p_user_id
  WHERE o.id = p_organization_id;

  SELECT es.id
  INTO v_status_id
  FROM public.employee_statuses es
  WHERE es.organization_id = p_organization_id
    AND lower(es.name) = 'active'
  ORDER BY es.created_at NULLS LAST
  LIMIT 1;

  SELECT d.id
  INTO v_department_id
  FROM public.departments d
  WHERE d.organization_id = p_organization_id
    AND d.is_default = true
  ORDER BY d.created_at NULLS LAST
  LIMIT 1;

  INSERT INTO public.employees (
    user_id,
    organization_id,
    full_name,
    email,
    employee_status_id,
    department_id,
    join_date
  )
  VALUES (
    p_user_id,
    p_organization_id,
    v_full_name,
    v_email,
    v_status_id,
    v_department_id,
    COALESCE((SELECT (o.created_at AT TIME ZONE 'UTC')::date FROM public.organizations o WHERE o.id = p_organization_id), CURRENT_DATE)
  )
  RETURNING id INTO v_employee_id;

  RETURN v_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_organization_owner_employee(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_organization_owner_employee(uuid, uuid, text, text) TO authenticated, service_role;

-- Owners in user_roles without a matching employees row in the same org.
INSERT INTO public.employees (
  user_id,
  organization_id,
  full_name,
  email,
  employee_status_id,
  department_id,
  join_date
)
SELECT
  ur.user_id,
  ur.organization_id,
  COALESCE(NULLIF(btrim(p.full_name), ''), 'Owner'),
  COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(o.email), '')),
  (
    SELECT es.id
    FROM public.employee_statuses es
    WHERE es.organization_id = ur.organization_id
      AND lower(es.name) = 'active'
    ORDER BY es.created_at NULLS LAST
    LIMIT 1
  ),
  (
    SELECT d.id
    FROM public.departments d
    WHERE d.organization_id = ur.organization_id
      AND d.is_default = true
    ORDER BY d.created_at NULLS LAST
    LIMIT 1
  ),
  COALESCE((o.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE)
FROM public.user_roles ur
JOIN public.organizations o ON o.id = ur.organization_id
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE ur.role = 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.organization_id = ur.organization_id
      AND e.user_id = ur.user_id
  );

COMMENT ON FUNCTION public.ensure_organization_owner_employee(uuid, uuid, text, text) IS
  'Idempotent: creates owner employees row for an organization if missing.';
