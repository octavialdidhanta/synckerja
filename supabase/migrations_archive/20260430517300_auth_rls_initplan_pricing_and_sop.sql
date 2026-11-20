-- Auth RLS initplan hardening for pricing & SOP tables
-- Follows pattern from 20260430500000_security_performance_advisor_hardening.sql:
-- replace direct auth.uid() usages inside RLS with (SELECT auth.uid())
-- so the planner can treat the auth call as an initplan instead of
-- re-evaluating per-row.

-- ---------------------------------------------------------------------------
-- business_expenses
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_tools_be_select" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_select"
  ON public.business_expenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_be_insert" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_insert"
  ON public.business_expenses FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_be_update" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_update"
  ON public.business_expenses FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_be_delete" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_delete"
  ON public.business_expenses FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- sales_channels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_tools_sc_select" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_select"
  ON public.sales_channels FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_sc_insert" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_insert"
  ON public.sales_channels FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_sc_update" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_update"
  ON public.sales_channels FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_sc_delete" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_delete"
  ON public.sales_channels FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- pricing_calculations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_tools_pc_select" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_select"
  ON public.pricing_calculations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_pc_insert" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_insert"
  ON public.pricing_calculations FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_pc_update" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_update"
  ON public.pricing_calculations FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_pc_delete" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_delete"
  ON public.pricing_calculations FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view own org default_prices" ON public.default_prices;
CREATE POLICY "Users can view own org default_prices"
  ON public.default_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = default_prices.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org default_prices" ON public.default_prices;
CREATE POLICY "Users can insert own org default_prices"
  ON public.default_prices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = default_prices.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org default_prices" ON public.default_prices;
CREATE POLICY "Users can update own org default_prices"
  ON public.default_prices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = default_prices.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = default_prices.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org default_prices" ON public.default_prices;
CREATE POLICY "Users can delete own org default_prices"
  ON public.default_prices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = default_prices.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- pricing_templates: merge multiple permissive SELECT policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_tools_pt_select_global" ON public.pricing_templates;
DROP POLICY IF EXISTS "pricing_tools_pt_select_org" ON public.pricing_templates;

CREATE POLICY "pricing_tools_pt_select"
  ON public.pricing_templates FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

-- keep existing INSERT/UPDATE/DELETE policies from base migration

-- ---------------------------------------------------------------------------
-- sop_templates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own org sop_templates" ON public.sop_templates;
CREATE POLICY "Users can view own org sop_templates"
  ON public.sop_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sop_templates.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org sop_templates" ON public.sop_templates;
CREATE POLICY "Users can insert own org sop_templates"
  ON public.sop_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sop_templates.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org sop_templates" ON public.sop_templates;
CREATE POLICY "Users can update own org sop_templates"
  ON public.sop_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sop_templates.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sop_templates.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org sop_templates" ON public.sop_templates;
CREATE POLICY "Users can delete own org sop_templates"
  ON public.sop_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = sop_templates.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- sop_template_steps: replace old via-org policies and auth.uid() usage
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view sop_template_steps via org" ON public.sop_template_steps;
DROP POLICY IF EXISTS "Users can insert sop_template_steps via org" ON public.sop_template_steps;
DROP POLICY IF EXISTS "Users can update sop_template_steps via org" ON public.sop_template_steps;
DROP POLICY IF EXISTS "Users can delete sop_template_steps via org" ON public.sop_template_steps;

DROP POLICY IF EXISTS "Users can view own org sop_template_steps" ON public.sop_template_steps;
CREATE POLICY "Users can view own org sop_template_steps"
  ON public.sop_template_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sop_templates st
      JOIN profiles p
        ON p.active_organization_id = st.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE st.id = sop_template_steps.sop_template_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org sop_template_steps" ON public.sop_template_steps;
CREATE POLICY "Users can insert own org sop_template_steps"
  ON public.sop_template_steps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sop_templates st
      JOIN profiles p
        ON p.active_organization_id = st.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE st.id = sop_template_steps.sop_template_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org sop_template_steps" ON public.sop_template_steps;
CREATE POLICY "Users can update own org sop_template_steps"
  ON public.sop_template_steps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sop_templates st
      JOIN profiles p
        ON p.active_organization_id = st.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE st.id = sop_template_steps.sop_template_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sop_templates st
      JOIN profiles p
        ON p.active_organization_id = st.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE st.id = sop_template_steps.sop_template_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org sop_template_steps" ON public.sop_template_steps;
CREATE POLICY "Users can delete own org sop_template_steps"
  ON public.sop_template_steps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sop_templates st
      JOIN profiles p
        ON p.active_organization_id = st.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE st.id = sop_template_steps.sop_template_id
    )
  );

