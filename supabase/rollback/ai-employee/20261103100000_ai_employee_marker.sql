-- Rollback 20261103100000_ai_employee_marker.sql
-- Jalankan setelah rollback attribution, profile, dan runs.

CREATE OR REPLACE FUNCTION public.count_active_employees_for_org(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.employees e
  LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
  WHERE e.organization_id = p_org_id
    AND COALESCE(e.pending_removal, false) = false
    AND lower(trim(COALESCE(es.name, 'active'))) IN ('active', 'probation');
$$;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_id_organization_id_key;

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_id_organization_id_key;

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS is_ai;
