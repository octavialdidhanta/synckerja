-- Employees: add NIK (Indonesian national ID) column used by HR UI.
-- Frontend validates NIK as 16 digits and checks uniqueness per organization.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS nik text NULL;

COMMENT ON COLUMN public.employees.nik IS 'NIK (16 digits) - Indonesian national ID number, scoped per organization.';

-- Enforce uniqueness per-organization when provided.
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_org_nik
  ON public.employees (organization_id, nik)
  WHERE nik IS NOT NULL;

