-- public.leave_allocations — synckerja-reference types (useEmployeeLeaveAllocations hook).
-- Fixes: PostgREST 404 / PGRST205 (table missing on deployed DB).

CREATE TABLE IF NOT EXISTS public.leave_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  allocation_type text NOT NULL,
  allocation_reason text NULL,
  days_allocated integer NOT NULL DEFAULT 0,
  allocation_date date NOT NULL,
  expires_at timestamptz NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_allocations_employee_id
  ON public.leave_allocations (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_allocations_organization_id
  ON public.leave_allocations (organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_allocations_allocation_date
  ON public.leave_allocations (allocation_date DESC);

COMMENT ON TABLE public.leave_allocations IS
  'Leave allocations per employee; aligns with synckerja-reference leave_allocations.';

ALTER TABLE public.leave_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_allocations_select" ON public.leave_allocations;
CREATE POLICY "leave_allocations_select"
  ON public.leave_allocations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "leave_allocations_insert" ON public.leave_allocations;
CREATE POLICY "leave_allocations_insert"
  ON public.leave_allocations FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "leave_allocations_update" ON public.leave_allocations;
CREATE POLICY "leave_allocations_update"
  ON public.leave_allocations FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "leave_allocations_delete" ON public.leave_allocations;
CREATE POLICY "leave_allocations_delete"
  ON public.leave_allocations FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS leave_allocations_updated_at ON public.leave_allocations;
CREATE TRIGGER leave_allocations_updated_at
  BEFORE UPDATE ON public.leave_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

