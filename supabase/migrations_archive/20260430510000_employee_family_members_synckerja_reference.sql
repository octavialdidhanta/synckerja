-- public.employee_family_members — synckerja-reference types (useFamilyMembers hooks).
-- Fixes PostgREST 404: /rest/v1/employee_family_members — table missing on deployed DB.

CREATE TABLE IF NOT EXISTS public.employee_family_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE SET NULL,
  name text NOT NULL,
  relationship text NOT NULL,
  gender text NULL,
  age integer NULL,
  occupation text NULL,
  address text NULL,
  phone text NULL,
  is_emergency_contact boolean NULL,
  photo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_family_members_employee_id
  ON public.employee_family_members (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_family_members_organization_id
  ON public.employee_family_members (organization_id);

COMMENT ON TABLE public.employee_family_members IS
  'Family members per employee; aligns with synckerja-reference employee_family_members.';

ALTER TABLE public.employee_family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_family_members_select" ON public.employee_family_members;
CREATE POLICY "employee_family_members_select"
  ON public.employee_family_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_family_members.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_family_members_insert" ON public.employee_family_members;
CREATE POLICY "employee_family_members_insert"
  ON public.employee_family_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_family_members.employee_id
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

DROP POLICY IF EXISTS "employee_family_members_update" ON public.employee_family_members;
CREATE POLICY "employee_family_members_update"
  ON public.employee_family_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_family_members.employee_id
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
      WHERE e.id = employee_family_members.employee_id
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

DROP POLICY IF EXISTS "employee_family_members_delete" ON public.employee_family_members;
CREATE POLICY "employee_family_members_delete"
  ON public.employee_family_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_family_members.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_employee_family_members_updated_at ON public.employee_family_members;
CREATE TRIGGER update_employee_family_members_updated_at
  BEFORE UPDATE ON public.employee_family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

