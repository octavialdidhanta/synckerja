-- A resigned person kept the organization in the switcher because the membership
-- row stayed, with is_active false and the old role still attached.

CREATE OR REPLACE FUNCTION public.resign_employee(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  emp public.employees%ROWTYPE;
  org_owner uuid;
  terminated_status uuid;
  next_org uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found or not in your organization.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.organization_id = emp.organization_id
      AND lower(ur.role) IN ('owner', 'admin', 'hr')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to resign this employee.';
  END IF;

  IF emp.user_id IS NOT NULL AND emp.user_id = uid THEN
    RAISE EXCEPTION 'You cannot resign yourself. Please contact another admin or the organization owner.';
  END IF;

  SELECT o.user_id INTO org_owner
  FROM public.organizations o
  WHERE o.id = emp.organization_id;

  IF org_owner IS NOT NULL AND emp.user_id = org_owner THEN
    RAISE EXCEPTION 'Organization owners cannot be resigned. Transfer ownership first.';
  END IF;

  UPDATE public.employees owner_row
  SET manager_id = NULL
  WHERE owner_row.organization_id = emp.organization_id
    AND owner_row.manager_id = emp.id
    AND org_owner IS NOT NULL
    AND owner_row.user_id = org_owner;

  IF EXISTS (
    SELECT 1
    FROM public.employees report
    WHERE report.organization_id = emp.organization_id
      AND report.manager_id = emp.id
  ) THEN
    RAISE EXCEPTION 'Reassign direct reports to another manager first.';
  END IF;

  SELECT es.id INTO terminated_status
  FROM public.employee_statuses es
  WHERE lower(es.name) = 'terminated'
  ORDER BY es.organization_id NULLS FIRST
  LIMIT 1;

  UPDATE public.employees e
  SET employee_status_id = COALESCE(terminated_status, e.employee_status_id),
      status = 'inactive',
      pending_removal = false,
      pending_removal_reason = NULL,
      pending_removal_date = NULL,
      updated_at = now()
  WHERE e.id = emp.id;

  IF emp.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles ur
    WHERE ur.user_id = emp.user_id
      AND ur.organization_id = emp.organization_id;

    DELETE FROM public.user_organizations uo
    WHERE uo.user_id = emp.user_id
      AND uo.organization_id = emp.organization_id;

    SELECT uo.organization_id INTO next_org
    FROM public.user_organizations uo
    JOIN public.organizations o ON o.id = uo.organization_id
    WHERE uo.user_id = emp.user_id
      AND COALESCE(uo.is_active, true) = true
    ORDER BY (o.user_id = emp.user_id) DESC, uo.organization_id
    LIMIT 1;

    UPDATE public.profiles p
    SET active_organization_id = next_org
    WHERE p.user_id = emp.user_id
      AND p.active_organization_id = emp.organization_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', emp.full_name || ' has been resigned from this organization'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resign_employee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resign_employee(uuid) TO authenticated;

-- Drop memberships that resign already turned off but left in the switcher.
DELETE FROM public.user_roles ur
USING public.user_organizations uo
JOIN public.employees e
  ON e.user_id = uo.user_id
 AND e.organization_id = uo.organization_id
JOIN public.organizations o ON o.id = uo.organization_id
LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
WHERE ur.user_id = uo.user_id
  AND ur.organization_id = uo.organization_id
  AND COALESCE(uo.is_active, true) = false
  AND e.user_id IS DISTINCT FROM o.user_id
  AND (
    lower(coalesce(e.status, '')) IN ('inactive', 'terminated', 'resigned')
    OR lower(coalesce(es.name, '')) IN ('inactive', 'terminated', 'resigned')
  );

DELETE FROM public.user_organizations uo
USING public.employees e
JOIN public.organizations o ON o.id = e.organization_id
LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
WHERE uo.user_id = e.user_id
  AND uo.organization_id = e.organization_id
  AND COALESCE(uo.is_active, true) = false
  AND e.user_id IS DISTINCT FROM o.user_id
  AND (
    lower(coalesce(e.status, '')) IN ('inactive', 'terminated', 'resigned')
    OR lower(coalesce(es.name, '')) IN ('inactive', 'terminated', 'resigned')
  );
