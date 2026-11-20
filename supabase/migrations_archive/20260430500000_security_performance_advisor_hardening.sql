-- Security & Performance Advisor hardening (Supabase linter).
-- - RLS on public.permission_configurations (was missing).
-- - Trigger helpers: immutable search_path (mitigate search_path hijacking).
-- - auth.uid() -> (SELECT auth.uid()) in RLS where flagged (initplan / per-row re-eval).
-- - Merge duplicate permissive SELECT policies (job_openings, recruitment_links).
-- - Leaked password protection: enable in Dashboard → Authentication → Attack Protection (not SQL).

-- ---------------------------------------------------------------------------
-- 1) permission_configurations: enable RLS + org-scoped writes; system rows read-only
-- ---------------------------------------------------------------------------
ALTER TABLE public.permission_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permission_configurations_select" ON public.permission_configurations;
CREATE POLICY "permission_configurations_select"
  ON public.permission_configurations FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "permission_configurations_insert" ON public.permission_configurations;
CREATE POLICY "permission_configurations_insert"
  ON public.permission_configurations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "permission_configurations_update" ON public.permission_configurations;
CREATE POLICY "permission_configurations_update"
  ON public.permission_configurations FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "permission_configurations_delete" ON public.permission_configurations;
CREATE POLICY "permission_configurations_delete"
  ON public.permission_configurations FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- 2) Trigger functions: SET search_path (Security Advisor: mutable search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_permission_configurations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_digital_asset_company_logos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_penalty_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attendance_penalty_payroll_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.payroll_periods_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT pp.id
  INTO NEW.payroll_periods_id
  FROM public.payroll_periods pp
  WHERE pp.organization_id = NEW.organization_id
    AND NEW.applied_date >= pp.start_date
    AND NEW.applied_date <= pp.end_date
  ORDER BY pp.start_date DESC
  LIMIT 1;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) user_profile_details: (SELECT auth.uid()) for initplan-friendly RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_profile_details_own" ON public.user_profile_details;
CREATE POLICY "user_profile_details_own"
  ON public.user_profile_details FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) digital_asset_company_logos: same auth pattern
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "digital_asset_company_logos_select" ON public.digital_asset_company_logos;
DROP POLICY IF EXISTS "digital_asset_company_logos_insert" ON public.digital_asset_company_logos;
DROP POLICY IF EXISTS "digital_asset_company_logos_update" ON public.digital_asset_company_logos;
DROP POLICY IF EXISTS "digital_asset_company_logos_delete" ON public.digital_asset_company_logos;

CREATE POLICY "digital_asset_company_logos_select"
  ON public.digital_asset_company_logos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = digital_asset_company_logos.organization_id
    )
  );

CREATE POLICY "digital_asset_company_logos_insert"
  ON public.digital_asset_company_logos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "digital_asset_company_logos_update"
  ON public.digital_asset_company_logos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = digital_asset_company_logos.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "digital_asset_company_logos_delete"
  ON public.digital_asset_company_logos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = digital_asset_company_logos.organization_id
    )
  );

-- Storage policies for same bucket (auth.uid() initplan)
DROP POLICY IF EXISTS "digital_asset_company_logos_storage_insert" ON storage.objects;
CREATE POLICY "digital_asset_company_logos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-asset-company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = (SELECT auth.uid()) AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_storage_select" ON storage.objects;
CREATE POLICY "digital_asset_company_logos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-asset-company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = (SELECT auth.uid()) AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_storage_delete" ON storage.objects;
CREATE POLICY "digital_asset_company_logos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-asset-company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = (SELECT auth.uid()) AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

-- ---------------------------------------------------------------------------
-- 5) job_openings: merge two permissive SELECT policies into one
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "job_openings_org_select" ON public.job_openings;
DROP POLICY IF EXISTS "job_openings_public_read_via_link" ON public.job_openings;

CREATE POLICY "job_openings_select"
  ON public.job_openings FOR SELECT TO anon, authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR EXISTS (
      SELECT 1
      FROM public.recruitment_links rl
      WHERE rl.job_opening_id = job_openings.id
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > pg_catalog.now())
    )
  );

-- INSERT/UPDATE/DELETE: members only (unchanged semantics; TO authenticated only)
DROP POLICY IF EXISTS "job_openings_org_insert" ON public.job_openings;
CREATE POLICY "job_openings_org_insert"
  ON public.job_openings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_openings_org_update" ON public.job_openings;
CREATE POLICY "job_openings_org_update"
  ON public.job_openings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_openings_org_delete" ON public.job_openings;
CREATE POLICY "job_openings_org_delete"
  ON public.job_openings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- 6) recruitment_links: merge two permissive SELECT policies into one
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recruitment_links_org_select" ON public.recruitment_links;
DROP POLICY IF EXISTS "recruitment_links_public_read_active" ON public.recruitment_links;

CREATE POLICY "recruitment_links_select"
  ON public.recruitment_links FOR SELECT TO anon, authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR (
      status = 'active'
      AND (expires_at IS NULL OR expires_at > pg_catalog.now())
    )
  );

DROP POLICY IF EXISTS "recruitment_links_org_insert" ON public.recruitment_links;
CREATE POLICY "recruitment_links_org_insert"
  ON public.recruitment_links FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "recruitment_links_org_update" ON public.recruitment_links;
CREATE POLICY "recruitment_links_org_update"
  ON public.recruitment_links FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "recruitment_links_org_delete" ON public.recruitment_links;
CREATE POLICY "recruitment_links_org_delete"
  ON public.recruitment_links FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
