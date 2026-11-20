-- Auth RLS initplan hardening for:
-- - public.passwords
-- - public.campaign_kpi_templates
-- Follows pattern from 20260430500000_security_performance_advisor_hardening.sql.

-- ---------------------------------------------------------------------------
-- passwords: replace direct auth.uid() in RLS policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own passwords in their organization" ON public.passwords;
CREATE POLICY "Users can view own passwords in their organization"
  ON public.passwords FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.organization_id = public.passwords.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own passwords in their organization" ON public.passwords;
CREATE POLICY "Users can insert own passwords in their organization"
  ON public.passwords FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.organization_id = public.passwords.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own passwords in their organization" ON public.passwords;
CREATE POLICY "Users can update own passwords in their organization"
  ON public.passwords FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.organization_id = public.passwords.organization_id
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.organization_id = public.passwords.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own passwords in their organization" ON public.passwords;
CREATE POLICY "Users can delete own passwords in their organization"
  ON public.passwords FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.organization_id = public.passwords.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- campaign_kpi_templates: replace direct auth.uid() in RLS policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view organization templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can view organization templates"
  ON public.campaign_kpi_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = campaign_kpi_templates.organization_id
    )
    AND (
      campaign_kpi_templates.is_public = TRUE
      OR campaign_kpi_templates.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can insert organization templates"
  ON public.campaign_kpi_templates
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = campaign_kpi_templates.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update their own templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can update their own templates"
  ON public.campaign_kpi_templates
  FOR UPDATE
  USING ((SELECT auth.uid()) = created_by)
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can delete their own templates"
  ON public.campaign_kpi_templates
  FOR DELETE
  USING ((SELECT auth.uid()) = created_by);

