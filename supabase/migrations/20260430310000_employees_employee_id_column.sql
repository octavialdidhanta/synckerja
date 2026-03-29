-- Human-readable employee number (HR / UI). Distinct from primary key employees.id (uuid).
-- Fixes PostgREST 400: column employees.employee_id does not exist

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_id text;

COMMENT ON COLUMN public.employees.employee_id IS
  'Display / HR employee code, unique per organization when set. Not the row primary key.';

-- Existing rows: sequential EMP-00001 per organization
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY COALESCE(created_at, '1970-01-01'::timestamptz), id
    ) AS rn
  FROM public.employees
  WHERE organization_id IS NOT NULL
    AND (employee_id IS NULL OR btrim(employee_id) = '')
)
UPDATE public.employees e
SET employee_id = 'EMP-' || lpad(ranked.rn::text, 5, '0')
FROM ranked
WHERE e.id = ranked.id;

-- Rows without organization_id
UPDATE public.employees
SET employee_id = 'EMP-' || upper(substring(replace(id::text, '-', ''), 1, 10))
WHERE employee_id IS NULL OR btrim(employee_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_organization_employee_id_unique
  ON public.employees (organization_id, employee_id)
  WHERE employee_id IS NOT NULL AND btrim(employee_id) <> '';

CREATE OR REPLACE FUNCTION public.employees_generate_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq int;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.employee_id IS NULL OR btrim(NEW.employee_id) = '') THEN
    IF NEW.organization_id IS NOT NULL THEN
      SELECT COALESCE(MAX((regexp_match(e.employee_id, '^EMP-([0-9]+)$'))[1]::int), 0) + 1
      INTO seq
      FROM public.employees e
      WHERE e.organization_id = NEW.organization_id;
      NEW.employee_id := 'EMP-' || lpad(seq::text, 5, '0');
    ELSE
      NEW.employee_id := 'EMP-' || upper(substring(replace(NEW.id::text, '-', ''), 1, 10));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_generate_employee_id_trg ON public.employees;
CREATE TRIGGER employees_generate_employee_id_trg
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  EXECUTE PROCEDURE public.employees_generate_employee_id();
