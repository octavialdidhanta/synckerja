-- Payroll go-live schema: TER brackets, audit log, paid tracking, payout snapshot, THR setting

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS payroll_thr_calculation_mode text NOT NULL DEFAULT 'proportional';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_payroll_thr_calculation_mode_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_payroll_thr_calculation_mode_check
  CHECK (payroll_thr_calculation_mode = ANY (ARRAY['manual_only'::text, 'proportional'::text, 'full_month_salary'::text]));

COMMENT ON COLUMN public.organizations.payroll_thr_calculation_mode IS
  'THR auto: manual_only (components only), proportional (months/12), full_month_salary (1x basic).';

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users (id);

ALTER TABLE public.employee_payroll_calculations
  ADD COLUMN IF NOT EXISTS payout_snapshot jsonb;

COMMENT ON COLUMN public.employee_payroll_calculations.payout_snapshot IS
  'Bank snapshot at calculation time: bank_name, account_number, account_holder.';

CREATE TABLE IF NOT EXISTS public.payroll_ter_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code text NOT NULL CHECK (category_code = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])),
  effective_year integer NOT NULL DEFAULT 2024,
  min_monthly_income numeric NOT NULL DEFAULT 0,
  max_monthly_income numeric,
  ter_rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_ter_brackets_unique UNIQUE (category_code, effective_year, min_monthly_income)
);

COMMENT ON TABLE public.payroll_ter_brackets IS 'PP 58/2023 TER brackets by category and monthly gross range.';

CREATE INDEX IF NOT EXISTS idx_payroll_ter_brackets_lookup
  ON public.payroll_ter_brackets (category_code, effective_year, min_monthly_income);

CREATE TABLE IF NOT EXISTS public.payroll_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  payroll_run_id uuid REFERENCES public.payroll_runs (id) ON DELETE SET NULL,
  employee_calculation_id uuid REFERENCES public.employee_payroll_calculations (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY[
    'calculated'::text, 'reprocessed'::text, 'marked_paid'::text,
    'export_bank'::text, 'payslip_generated'::text
  ])),
  actor_user_id uuid REFERENCES auth.users (id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_audit_log_org ON public.payroll_audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_log_run ON public.payroll_audit_log (payroll_run_id);

ALTER TABLE public.payroll_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_audit_log_org_select ON public.payroll_audit_log;
CREATE POLICY payroll_audit_log_org_select ON public.payroll_audit_log
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Employee self-read paid calculations only
DROP POLICY IF EXISTS employee_payroll_calculations_employee_select_own ON public.employee_payroll_calculations;
CREATE POLICY employee_payroll_calculations_employee_select_own ON public.employee_payroll_calculations
  FOR SELECT TO authenticated
  USING (
    payment_status = 'paid'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_payroll_calculations.employee_id
        AND e.user_id = (SELECT auth.uid())
        AND e.organization_id = employee_payroll_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS payroll_items_employee_select_own ON public.payroll_items;
CREATE POLICY payroll_items_employee_select_own ON public.payroll_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.id = payroll_items.payroll_calculation_id
        AND c.payment_status = 'paid'
        AND e.user_id = (SELECT auth.uid())
    )
  );
