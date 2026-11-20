-- public.employee_informal_educations - synckerja-reference types (useInformalEducations hooks).
-- Fixes PostgREST PGRST205: table missing on deployed DB.

CREATE TABLE IF NOT EXISTS public.employee_informal_educations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE SET NULL,
  course_name text NOT NULL,
  provider text NULL,
  field_of_certification text NULL,
  certificate_number text NULL,
  start_date date NULL,
  end_date date NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_employee_informal_educations_employee_id FOREIGN KEY (employee_id)
    REFERENCES public.employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_informal_educations_employee_id
  ON public.employee_informal_educations (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_informal_educations_organization_id
  ON public.employee_informal_educations (organization_id);

COMMENT ON TABLE public.employee_informal_educations IS
  'Courses/certifications per employee; aligns with synckerja-reference employee_informal_educations.';

ALTER TABLE public.employee_informal_educations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_informal_educations_select" ON public.employee_informal_educations;
CREATE POLICY "employee_informal_educations_select"
  ON public.employee_informal_educations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_informal_educations.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_informal_educations_insert" ON public.employee_informal_educations;
CREATE POLICY "employee_informal_educations_insert"
  ON public.employee_informal_educations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_informal_educations.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "employee_informal_educations_update" ON public.employee_informal_educations;
CREATE POLICY "employee_informal_educations_update"
  ON public.employee_informal_educations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_informal_educations.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_informal_educations.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "employee_informal_educations_delete" ON public.employee_informal_educations;
CREATE POLICY "employee_informal_educations_delete"
  ON public.employee_informal_educations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_informal_educations.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_employee_informal_educations_updated_at ON public.employee_informal_educations;
CREATE TRIGGER update_employee_informal_educations_updated_at
  BEFORE UPDATE ON public.employee_informal_educations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
