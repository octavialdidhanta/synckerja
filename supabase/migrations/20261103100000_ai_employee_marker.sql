-- AI Employee fase 1: penanda karyawan AI dan kuota karyawan manusia.
-- Tidak membuat baris Naya atau data lain.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.is_ai IS
  'True untuk karyawan AI. Tidak dihitung di kuota langganan karyawan manusia.';

ALTER TABLE public.employees
  ADD CONSTRAINT employees_id_organization_id_key UNIQUE (id, organization_id);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_id_organization_id_key UNIQUE (id, organization_id);

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
    AND COALESCE(e.is_ai, false) = false
    AND lower(trim(COALESCE(es.name, 'active'))) IN ('active', 'probation');
$$;

COMMENT ON FUNCTION public.count_active_employees_for_org(uuid) IS
  'Jumlah karyawan manusia aktif/probation. Karyawan is_ai tidak dihitung.';
