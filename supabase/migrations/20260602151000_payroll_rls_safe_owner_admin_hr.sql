-- Payroll RLS (safe/recommended):
-- - owner/admin/hr: full access to payroll tables for their org
-- - employee: can only read their own PAID calculations + items (and minimal context for payslips)
--
-- Notes:
-- - This migration intentionally does NOT touch public.payroll_periods because it is also used by penalties/attendance.
-- - Existing employee self-read policies created in payroll go-live schema are kept (paid-only).

-- ---------------------------------------------------------------------------
-- Helper predicate: is HR/admin/owner within org
-- (We inline it as EXISTS to avoid relying on additional helper functions.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- employee_payroll_calculations
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.employee_payroll_calculations ENABLE ROW LEVEL SECURITY;

-- Remove overly-permissive policy (allowed any org member to read/write everything).
DROP POLICY IF EXISTS employee_payroll_calculations_org_all ON public.employee_payroll_calculations;

-- Management: full read
DROP POLICY IF EXISTS employee_payroll_calculations_select_management ON public.employee_payroll_calculations;
CREATE POLICY employee_payroll_calculations_select_management
  ON public.employee_payroll_calculations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_calculations.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

-- Management: write
DROP POLICY IF EXISTS employee_payroll_calculations_write_management ON public.employee_payroll_calculations;
CREATE POLICY employee_payroll_calculations_write_management
  ON public.employee_payroll_calculations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_calculations.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_calculations.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

-- Keep existing policy `employee_payroll_calculations_employee_select_own` (paid-only) from 20260530170000.

-- ---------------------------------------------------------------------------
-- payroll_items
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_items_org_all ON public.payroll_items;

-- Management: full read
DROP POLICY IF EXISTS payroll_items_select_management ON public.payroll_items;
CREATE POLICY payroll_items_select_management
  ON public.payroll_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      WHERE c.id = payroll_items.payroll_calculation_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = c.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
    )
  );

-- Management: write
DROP POLICY IF EXISTS payroll_items_write_management ON public.payroll_items;
CREATE POLICY payroll_items_write_management
  ON public.payroll_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      WHERE c.id = payroll_items.payroll_calculation_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = c.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      WHERE c.id = payroll_items.payroll_calculation_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = c.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
    )
  );

-- Keep existing policy `payroll_items_employee_select_own` (paid-only) from 20260530170000.

-- ---------------------------------------------------------------------------
-- payroll_runs (needed for payslip embed)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.payroll_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_runs_org_all ON public.payroll_runs;

-- Management: read/write
DROP POLICY IF EXISTS payroll_runs_select_management ON public.payroll_runs;
CREATE POLICY payroll_runs_select_management
  ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = payroll_runs.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS payroll_runs_write_management ON public.payroll_runs;
CREATE POLICY payroll_runs_write_management
  ON public.payroll_runs
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = payroll_runs.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = payroll_runs.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

-- Employee: allow reading only runs that contain their PAID calculations (for MyPayslips embed).
DROP POLICY IF EXISTS payroll_runs_employee_select_paid_context ON public.payroll_runs;
CREATE POLICY payroll_runs_employee_select_paid_context
  ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.payroll_run_id = payroll_runs.id
        AND c.payment_status = 'paid'
        AND e.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- employee_payroll_info (needed for payslip PDF: npwp/ptkp_status + employee identity embed)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.employee_payroll_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_payroll_info_org_all ON public.employee_payroll_info;

-- Management: read/write
DROP POLICY IF EXISTS employee_payroll_info_select_management ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_select_management
  ON public.employee_payroll_info
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS employee_payroll_info_write_management ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_write_management
  ON public.employee_payroll_info
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

-- Employee: allow reading their own payroll info only if they have at least one PAID calculation.
DROP POLICY IF EXISTS employee_payroll_info_employee_select_paid_context ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_employee_select_paid_context
  ON public.employee_payroll_info
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_payroll_info.employee_id
        AND e.user_id = (SELECT auth.uid())
        AND e.organization_id = employee_payroll_info.organization_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      WHERE c.employee_id = employee_payroll_info.employee_id
        AND c.organization_id = employee_payroll_info.organization_id
        AND c.payment_status = 'paid'
    )
  );

-- ---------------------------------------------------------------------------
-- employee_payroll_components (HR-only; components are internal payroll config)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.employee_payroll_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_payroll_components_org_all ON public.employee_payroll_components;

DROP POLICY IF EXISTS employee_payroll_components_select_management ON public.employee_payroll_components;
CREATE POLICY employee_payroll_components_select_management
  ON public.employee_payroll_components
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_components.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS employee_payroll_components_write_management ON public.employee_payroll_components;
CREATE POLICY employee_payroll_components_write_management
  ON public.employee_payroll_components
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_components.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_components.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

-- ---------------------------------------------------------------------------
-- tax_configurations (HR-only; org-level payroll setup)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.tax_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_configurations_org_all ON public.tax_configurations;

DROP POLICY IF EXISTS tax_configurations_select_management ON public.tax_configurations;
CREATE POLICY tax_configurations_select_management
  ON public.tax_configurations
  FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()))
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = COALESCE(tax_configurations.organization_id, ur.organization_id)
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS tax_configurations_write_management ON public.tax_configurations;
CREATE POLICY tax_configurations_write_management
  ON public.tax_configurations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = tax_configurations.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = tax_configurations.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

