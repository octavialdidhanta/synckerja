-- Link employees created without organization_id (onboarding) to their org so
-- get_subscription_status / count_active_employees_for_org return correct counts.
-- Align active count with synckerja-reference calculate_current_members (LEFT JOIN + coalesce name).

UPDATE public.employees e
SET organization_id = p.active_organization_id
FROM public.profiles p
WHERE e.user_id = p.user_id
  AND e.organization_id IS NULL
  AND p.active_organization_id IS NOT NULL;

UPDATE public.employees e
SET organization_id = sub.org_id
FROM (
  SELECT DISTINCT ON (e2.user_id) e2.user_id AS uid, uo.organization_id AS org_id
  FROM public.employees e2
  INNER JOIN public.user_organizations uo ON uo.user_id = e2.user_id
  WHERE e2.organization_id IS NULL
  ORDER BY e2.user_id, uo.joined_at ASC
) sub
WHERE e.user_id = sub.uid
  AND e.organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.count_active_employees_for_org(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT count(*)::integer
    FROM public.employees e
    LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
    WHERE e.organization_id = p_org_id
      AND COALESCE(e.pending_removal, false) = false
      AND lower(COALESCE(es.name, 'active')) IN ('active', 'probation')
  ), 0);
$$;
