-- Satu rentang tanggal biasa per organisasi, dan satu payroll run per periode.
-- Empat run "Juli 2026 (2FA QA)" lolos karena masing-masing punya periode sendiri
-- dengan tanggal yang sama. Bonus/THR tetap boleh memakai tanggal yang sama.
-- Rollback: supabase/rollback/20261104_payroll_one_span_one_run_rollback.sql

CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_one_span_per_kind
  ON public.payroll_periods (
    organization_id,
    start_date,
    end_date,
    (COALESCE(is_bonus_period, false))
  );

CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_one_per_period
  ON public.payroll_runs (payroll_period_id);
