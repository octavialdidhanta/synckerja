-- public.employee_work_experiences - synckerja-reference types (useWorkExperiences hooks).
-- Fixes PostgREST PGRST205: table missing on deployed DB.

CREATE TABLE IF NOT EXISTS public.employee_work_experiences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE SET NULL,
  company_name text NOT NULL,
  position text NOT NULL,
  location text NULL,
  start_date date NULL,
  end_date date NULL,
  is_current boolean NULL DEFAULT false,
  job_description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_employee_work_experiences_employee_id FOREIGN KEY (employee_id)
    REFERENCES public.employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_work_experiences_employee_id
  ON public.employee_work_experiences (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_work_experiences_organization_id
  ON public.employee_work_experiences (organization_id);

COMMENT ON TABLE public.employee_work_experiences IS
  'Prior jobs per employee; aligns with synckerja-reference employee_work_experiences.';

ALTER TABLE public.employee_work_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_work_experiences_select" ON public.employee_work_experiences;
CREATE POLICY "employee_work_experiences_select"
  ON public.employee_work_experiences FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_work_experiences.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_work_experiences_insert" ON public.employee_work_experiences;
CREATE POLICY "employee_work_experiences_insert"
  ON public.employee_work_experiences FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_work_experiences.employee_id
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

DROP POLICY IF EXISTS "employee_work_experiences_update" ON public.employee_work_experiences;
CREATE POLICY "employee_work_experiences_update"
  ON public.employee_work_experiences FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_work_experiences.employee_id
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
      WHERE e.id = employee_work_experiences.employee_id
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

DROP POLICY IF EXISTS "employee_work_experiences_delete" ON public.employee_work_experiences;
CREATE POLICY "employee_work_experiences_delete"
  ON public.employee_work_experiences FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_work_experiences.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_employee_work_experiences_updated_at ON public.employee_work_experiences;
CREATE TRIGGER update_employee_work_experiences_updated_at
  BEFORE UPDATE ON public.employee_work_experiences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
