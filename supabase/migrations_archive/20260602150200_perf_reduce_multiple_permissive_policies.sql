-- Performance Advisor: reduce "Multiple Permissive Policies" noise
-- Keep effective access the same, but avoid overlapping FOR ALL + FOR SELECT policies
-- by scoping write-block / admin-write policies to write commands only.
--
-- Also fixes Auth RLS Initialization Plan for customer_survey_responses by wrapping auth.uid().

-- ---------------------------------------------------------------------------
-- customer_survey_responses: wrap auth.uid() to scalar subquery
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS customer_survey_responses_select_org ON public.customer_survey_responses;
CREATE POLICY customer_survey_responses_select_org
  ON public.customer_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = customer_survey_responses.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- google_ads_conversion_uploads: keep SELECT policy; block only writes (not SELECT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS google_ads_conversion_uploads_block_authenticated_writes ON public.google_ads_conversion_uploads;

DROP POLICY IF EXISTS google_ads_conversion_uploads_block_authenticated_insert ON public.google_ads_conversion_uploads;
CREATE POLICY google_ads_conversion_uploads_block_authenticated_insert
  ON public.google_ads_conversion_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS google_ads_conversion_uploads_block_authenticated_update ON public.google_ads_conversion_uploads;
CREATE POLICY google_ads_conversion_uploads_block_authenticated_update
  ON public.google_ads_conversion_uploads
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS google_ads_conversion_uploads_block_authenticated_delete ON public.google_ads_conversion_uploads;
CREATE POLICY google_ads_conversion_uploads_block_authenticated_delete
  ON public.google_ads_conversion_uploads
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- meta_ads_conversion_uploads: keep SELECT policy; block only writes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS meta_ads_conversion_uploads_block_writes ON public.meta_ads_conversion_uploads;

DROP POLICY IF EXISTS meta_ads_conversion_uploads_block_insert ON public.meta_ads_conversion_uploads;
CREATE POLICY meta_ads_conversion_uploads_block_insert
  ON public.meta_ads_conversion_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS meta_ads_conversion_uploads_block_update ON public.meta_ads_conversion_uploads;
CREATE POLICY meta_ads_conversion_uploads_block_update
  ON public.meta_ads_conversion_uploads
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS meta_ads_conversion_uploads_block_delete ON public.meta_ads_conversion_uploads;
CREATE POLICY meta_ads_conversion_uploads_block_delete
  ON public.meta_ads_conversion_uploads
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- org Google Ads: keep SELECT policy; scope admin_write to writes only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organization_google_ads_connections_admin_write ON public.organization_google_ads_connections;
DROP POLICY IF EXISTS organization_google_ads_connections_admin_insert ON public.organization_google_ads_connections;
CREATE POLICY organization_google_ads_connections_admin_insert
  ON public.organization_google_ads_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_google_ads_connections_admin_update ON public.organization_google_ads_connections;
CREATE POLICY organization_google_ads_connections_admin_update
  ON public.organization_google_ads_connections
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_google_ads_connections_admin_delete ON public.organization_google_ads_connections;
CREATE POLICY organization_google_ads_connections_admin_delete
  ON public.organization_google_ads_connections
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_google_ads_accounts_admin_write ON public.organization_google_ads_accounts;
DROP POLICY IF EXISTS organization_google_ads_accounts_admin_insert ON public.organization_google_ads_accounts;
CREATE POLICY organization_google_ads_accounts_admin_insert
  ON public.organization_google_ads_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_google_ads_accounts_admin_update ON public.organization_google_ads_accounts;
CREATE POLICY organization_google_ads_accounts_admin_update
  ON public.organization_google_ads_accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_google_ads_accounts_admin_delete ON public.organization_google_ads_accounts;
CREATE POLICY organization_google_ads_accounts_admin_delete
  ON public.organization_google_ads_accounts
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- org Meta Ads: keep SELECT policy; scope admin_write to writes only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organization_meta_ads_connections_admin_write ON public.organization_meta_ads_connections;
DROP POLICY IF EXISTS organization_meta_ads_connections_admin_insert ON public.organization_meta_ads_connections;
CREATE POLICY organization_meta_ads_connections_admin_insert
  ON public.organization_meta_ads_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_meta_ads_connections_admin_update ON public.organization_meta_ads_connections;
CREATE POLICY organization_meta_ads_connections_admin_update
  ON public.organization_meta_ads_connections
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_meta_ads_connections_admin_delete ON public.organization_meta_ads_connections;
CREATE POLICY organization_meta_ads_connections_admin_delete
  ON public.organization_meta_ads_connections
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_meta_ads_accounts_admin_write ON public.organization_meta_ads_accounts;
DROP POLICY IF EXISTS organization_meta_ads_accounts_admin_insert ON public.organization_meta_ads_accounts;
CREATE POLICY organization_meta_ads_accounts_admin_insert
  ON public.organization_meta_ads_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_meta_ads_accounts_admin_update ON public.organization_meta_ads_accounts;
CREATE POLICY organization_meta_ads_accounts_admin_update
  ON public.organization_meta_ads_accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS organization_meta_ads_accounts_admin_delete ON public.organization_meta_ads_accounts;
CREATE POLICY organization_meta_ads_accounts_admin_delete
  ON public.organization_meta_ads_accounts
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

-- Meta Ads metrics preferences: keep SELECT policy; scope write to writes only
DROP POLICY IF EXISTS organization_meta_ads_metrics_preferences_write ON public.organization_meta_ads_metrics_preferences;
DROP POLICY IF EXISTS organization_meta_ads_metrics_preferences_insert ON public.organization_meta_ads_metrics_preferences;
CREATE POLICY organization_meta_ads_metrics_preferences_insert
  ON public.organization_meta_ads_metrics_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS organization_meta_ads_metrics_preferences_update ON public.organization_meta_ads_metrics_preferences;
CREATE POLICY organization_meta_ads_metrics_preferences_update
  ON public.organization_meta_ads_metrics_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS organization_meta_ads_metrics_preferences_delete ON public.organization_meta_ads_metrics_preferences;
CREATE POLICY organization_meta_ads_metrics_preferences_delete
  ON public.organization_meta_ads_metrics_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- reprimands: replace broad FOR ALL policy with split SELECT + WRITE to avoid overlap
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reprimands_hr_management_all ON public.reprimands;

-- SELECT: HR/admin/owner can read org; employees can read own (paid attention to existing employee policy)
DROP POLICY IF EXISTS reprimands_select_access ON public.reprimands;
CREATE POLICY reprimands_select_access ON public.reprimands
  FOR SELECT
  TO authenticated
  USING (
    (
      organization_id IN (SELECT public.user_organization_ids())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = reprimands.organization_id
          AND ur.role IN ('owner', 'admin', 'hr')
      )
    )
    OR (
      organization_id IN (SELECT public.user_organization_ids())
      AND EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.id = reprimands.employee_id
          AND e.user_id = (SELECT auth.uid())
          AND e.organization_id = reprimands.organization_id
      )
    )
  );

-- WRITE: HR/admin/owner only (same condition as previous FOR ALL)
DROP POLICY IF EXISTS reprimands_hr_management_write ON public.reprimands;
CREATE POLICY reprimands_hr_management_write ON public.reprimands
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = reprimands.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = reprimands.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

