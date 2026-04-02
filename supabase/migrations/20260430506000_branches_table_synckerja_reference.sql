-- HR branches master (synckerja-reference public.branches Row / branchUtils / employees.branch_id).
-- Fixes PostgREST 404: GET /rest/v1/branches — table was missing on deployed DB.

CREATE TABLE IF NOT EXISTS public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NULL,
  address text NULL,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.branches IS
  'Organization branches (HR); organization_id NULL = shared default rows. Aligns with synckerja-reference.';

CREATE INDEX IF NOT EXISTS idx_branches_organization_id ON public.branches (organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_name_org ON public.branches (organization_id, lower(name));

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_org_select" ON public.branches;
CREATE POLICY "branches_org_select"
  ON public.branches FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "branches_org_insert" ON public.branches;
CREATE POLICY "branches_org_insert"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "branches_org_update" ON public.branches;
CREATE POLICY "branches_org_update"
  ON public.branches FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "branches_org_delete" ON public.branches;
CREATE POLICY "branches_org_delete"
  ON public.branches FOR DELETE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- employees.branch_id (FK to branches; optional column for employment / UI)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_branch_id_fkey'
      AND conrelid = 'public.employees'::regclass
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON public.employees (branch_id);
