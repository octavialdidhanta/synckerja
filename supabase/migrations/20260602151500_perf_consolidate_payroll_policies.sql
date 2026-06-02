-- Performance Advisor: reduce "Multiple Permissive Policies" for payroll tables
-- by consolidating SELECT into a single policy (management OR employee self-paid),
-- and scoping management writes to INSERT/UPDATE/DELETE (not FOR ALL).
--
-- This keeps the "safe payroll" access model:
-- - owner/admin/hr: full access within org
-- - employee: read own PAID calculations + items, plus minimal context for payslips

-- ---------------------------------------------------------------------------
-- employee_payroll_calculations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_payroll_calculations_select_management ON public.employee_payroll_calculations;
DROP POLICY IF EXISTS employee_payroll_calculations_employee_select_own ON public.employee_payroll_calculations;

DROP POLICY IF EXISTS employee_payroll_calculations_select_safe ON public.employee_payroll_calculations;
CREATE POLICY employee_payroll_calculations_select_safe
  ON public.employee_payroll_calculations
  FOR SELECT
  TO authenticated
  USING (
    (
      organization_id IN (SELECT public.user_organization_ids())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = employee_payroll_calculations.organization_id
          AND ur.role IN ('owner', 'admin', 'hr')
      )
    )
    OR (
      payment_status = 'paid'
      AND EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.id = employee_payroll_calculations.employee_id
          AND e.user_id = (SELECT auth.uid())
          AND e.organization_id = employee_payroll_calculations.organization_id
      )
    )
  );

DROP POLICY IF EXISTS employee_payroll_calculations_write_management ON public.employee_payroll_calculations;
DROP POLICY IF EXISTS employee_payroll_calculations_insert_management ON public.employee_payroll_calculations;
DROP POLICY IF EXISTS employee_payroll_calculations_update_management ON public.employee_payroll_calculations;
DROP POLICY IF EXISTS employee_payroll_calculations_delete_management ON public.employee_payroll_calculations;

CREATE POLICY employee_payroll_calculations_insert_management
  ON public.employee_payroll_calculations
  FOR INSERT
  TO authenticated
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

CREATE POLICY employee_payroll_calculations_update_management
  ON public.employee_payroll_calculations
  FOR UPDATE
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

CREATE POLICY employee_payroll_calculations_delete_management
  ON public.employee_payroll_calculations
  FOR DELETE
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

-- ---------------------------------------------------------------------------
-- payroll_items
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_items_select_management ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_employee_select_own ON public.payroll_items;

DROP POLICY IF EXISTS payroll_items_select_safe ON public.payroll_items;
CREATE POLICY payroll_items_select_safe
  ON public.payroll_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.id = payroll_items.payroll_calculation_id
        AND (
          (
            c.organization_id IN (SELECT public.user_organization_ids())
            AND EXISTS (
              SELECT 1
              FROM public.user_roles ur
              WHERE ur.user_id = (SELECT auth.uid())
                AND ur.organization_id = c.organization_id
                AND ur.role IN ('owner', 'admin', 'hr')
            )
          )
          OR (c.payment_status = 'paid' AND e.user_id = (SELECT auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS payroll_items_write_management ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_insert_management ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_update_management ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_delete_management ON public.payroll_items;

CREATE POLICY payroll_items_insert_management
  ON public.payroll_items
  FOR INSERT
  TO authenticated
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

CREATE POLICY payroll_items_update_management
  ON public.payroll_items
  FOR UPDATE
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

CREATE POLICY payroll_items_delete_management
  ON public.payroll_items
  FOR DELETE
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

-- ---------------------------------------------------------------------------
-- payroll_runs (payslip context): consolidate selects
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_runs_select_management ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_employee_select_paid_context ON public.payroll_runs;

DROP POLICY IF EXISTS payroll_runs_select_safe ON public.payroll_runs;
CREATE POLICY payroll_runs_select_safe
  ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    (
      organization_id IN (SELECT public.user_organization_ids())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = payroll_runs.organization_id
          AND ur.role IN ('owner', 'admin', 'hr')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.payroll_run_id = payroll_runs.id
        AND c.payment_status = 'paid'
        AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS payroll_runs_write_management ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_insert_management ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_update_management ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_delete_management ON public.payroll_runs;

CREATE POLICY payroll_runs_insert_management
  ON public.payroll_runs
  FOR INSERT
  TO authenticated
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

CREATE POLICY payroll_runs_update_management
  ON public.payroll_runs
  FOR UPDATE
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

CREATE POLICY payroll_runs_delete_management
  ON public.payroll_runs
  FOR DELETE
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

-- ---------------------------------------------------------------------------
-- employee_payroll_info (payslip context): consolidate selects
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_payroll_info_select_management ON public.employee_payroll_info;
DROP POLICY IF EXISTS employee_payroll_info_employee_select_paid_context ON public.employee_payroll_info;

DROP POLICY IF EXISTS employee_payroll_info_select_safe ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_select_safe
  ON public.employee_payroll_info
  FOR SELECT
  TO authenticated
  USING (
    (
      organization_id IN (SELECT public.user_organization_ids())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = employee_payroll_info.organization_id
          AND ur.role IN ('owner', 'admin', 'hr')
      )
    )
    OR (
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
    )
  );

-- Keep management writes already defined by 20260602151000 (they will be split if needed later).

-- ---------------------------------------------------------------------------
-- employee_payroll_components & tax_configurations:
-- These are management-only tables; keep a single SELECT policy and split writes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_payroll_components_select_management ON public.employee_payroll_components;
DROP POLICY IF EXISTS employee_payroll_components_write_management ON public.employee_payroll_components;

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

DROP POLICY IF EXISTS employee_payroll_components_insert_management ON public.employee_payroll_components;
CREATE POLICY employee_payroll_components_insert_management
  ON public.employee_payroll_components
  FOR INSERT
  TO authenticated
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

DROP POLICY IF EXISTS employee_payroll_components_update_management ON public.employee_payroll_components;
CREATE POLICY employee_payroll_components_update_management
  ON public.employee_payroll_components
  FOR UPDATE
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

DROP POLICY IF EXISTS employee_payroll_components_delete_management ON public.employee_payroll_components;
CREATE POLICY employee_payroll_components_delete_management
  ON public.employee_payroll_components
  FOR DELETE
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

DROP POLICY IF EXISTS tax_configurations_select_management ON public.tax_configurations;
DROP POLICY IF EXISTS tax_configurations_write_management ON public.tax_configurations;

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
        AND ur.organization_id IN (SELECT public.user_organization_ids())
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS tax_configurations_insert_management ON public.tax_configurations;
CREATE POLICY tax_configurations_insert_management
  ON public.tax_configurations
  FOR INSERT
  TO authenticated
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

DROP POLICY IF EXISTS tax_configurations_update_management ON public.tax_configurations;
CREATE POLICY tax_configurations_update_management
  ON public.tax_configurations
  FOR UPDATE
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

DROP POLICY IF EXISTS tax_configurations_delete_management ON public.tax_configurations;
CREATE POLICY tax_configurations_delete_management
  ON public.tax_configurations
  FOR DELETE
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
  );

