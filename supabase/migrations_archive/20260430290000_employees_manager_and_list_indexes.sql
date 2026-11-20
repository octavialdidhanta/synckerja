-- Employees: manager_id (self-FK, nullable) + composite indexes for list queries (reference-aligned).
-- Skips reference backfill/trigger blocks to avoid failing orgs without an owner employee row; app enforces UX.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_manager_id_fkey'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.employees (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees (manager_id);

CREATE INDEX IF NOT EXISTS idx_employees_organization_id_manager_id ON public.employees (organization_id, manager_id);

CREATE INDEX IF NOT EXISTS idx_employees_organization_id_status ON public.employees (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_employees_organization_id_full_name ON public.employees (organization_id, full_name);
