-- Security Advisor: enable RLS on public tables exposed to PostgREST (KOL, carousel, approval, employee_targets).
-- Org scope: public.user_organization_ids() (same pattern as kol_content_posts, social_media_plans, employee_targets).

-- ---------------------------------------------------------------------------
-- Direct organization_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.kol_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_campaigns_org_all" ON public.kol_campaigns;
CREATE POLICY "kol_campaigns_org_all" ON public.kol_campaigns
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.kol_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_profiles_org_all" ON public.kol_profiles;
CREATE POLICY "kol_profiles_org_all" ON public.kol_profiles
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.kol_campaign_deliverables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_campaign_deliverables_org_all" ON public.kol_campaign_deliverables;
CREATE POLICY "kol_campaign_deliverables_org_all" ON public.kol_campaign_deliverables
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.kol_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_contracts_org_all" ON public.kol_contracts;
CREATE POLICY "kol_contracts_org_all" ON public.kol_contracts
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.kol_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_ratings_org_all" ON public.kol_ratings;
CREATE POLICY "kol_ratings_org_all" ON public.kol_ratings
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.kol_performance_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_performance_thresholds_org_all" ON public.kol_performance_thresholds;
CREATE POLICY "kol_performance_thresholds_org_all" ON public.kol_performance_thresholds
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.kol_campaign_budget_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_campaign_budget_allocations_org_all" ON public.kol_campaign_budget_allocations;
CREATE POLICY "kol_campaign_budget_allocations_org_all" ON public.kol_campaign_budget_allocations
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.employee_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_targets_org" ON public.employee_targets;
CREATE POLICY "employee_targets_org" ON public.employee_targets
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- App: approval_access_configurations filtered by organization_id
ALTER TABLE public.approval_access_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_access_configurations_org_all" ON public.approval_access_configurations;
CREATE POLICY "approval_access_configurations_org_all" ON public.approval_access_configurations
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Via parent (kol_profiles.organization_id)
-- ---------------------------------------------------------------------------

ALTER TABLE public.kol_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_rates_org_all" ON public.kol_rates;
CREATE POLICY "kol_rates_org_all" ON public.kol_rates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kol_profiles kp
      WHERE kp.id = kol_rates.kol_profile_id
        AND kp.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.kol_profiles kp
      WHERE kp.id = kol_rates.kol_profile_id
        AND kp.organization_id IN (SELECT public.user_organization_ids())
    )
  );

ALTER TABLE public.kol_social_media_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_social_media_accounts_org_all" ON public.kol_social_media_accounts;
CREATE POLICY "kol_social_media_accounts_org_all" ON public.kol_social_media_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kol_profiles kp
      WHERE kp.id = kol_social_media_accounts.kol_profile_id
        AND kp.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.kol_profiles kp
      WHERE kp.id = kol_social_media_accounts.kol_profile_id
        AND kp.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Via kol_campaigns.organization_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.kol_campaign_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kol_campaign_assignments_org_all" ON public.kol_campaign_assignments;
CREATE POLICY "kol_campaign_assignments_org_all" ON public.kol_campaign_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kol_campaigns c
      WHERE c.id = kol_campaign_assignments.campaign_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.kol_campaigns c
      INNER JOIN public.kol_profiles kp ON kp.id = kol_campaign_assignments.kol_profile_id
      WHERE c.id = kol_campaign_assignments.campaign_id
        AND c.organization_id = kp.organization_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Via social_media_plans.organization_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.social_media_plan_carousel_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_media_plan_carousel_images_org_all" ON public.social_media_plan_carousel_images;
CREATE POLICY "social_media_plan_carousel_images_org_all" ON public.social_media_plan_carousel_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans smp
      WHERE smp.id = social_media_plan_carousel_images.social_media_plan_id
        AND smp.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans smp
      WHERE smp.id = social_media_plan_carousel_images.social_media_plan_id
        AND smp.organization_id IN (SELECT public.user_organization_ids())
    )
  );
