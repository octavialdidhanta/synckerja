-- Audit columns used by Daily Task completion approval flows (approve/reject/sync).
ALTER TABLE public.completion_approvals
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS rejected_by uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.completion_approvals.approved_by IS 'Employee who approved the completion.';
COMMENT ON COLUMN public.completion_approvals.rejected_by IS 'Employee who rejected the completion.';

-- Backfill updated_at for existing rows.
UPDATE public.completion_approvals
SET updated_at = COALESCE(rejected_at, completed_at, created_at)
WHERE updated_at IS NULL;
