-- Performance Advisor follow-up:
-- 1) Auth RLS initplan: sniping_images — wrap auth.uid() as (SELECT auth.uid()).
-- 2) Multiple permissive policies: drop legacy FOR ALL policies on services/sub_services (keep granular policies from income module).
-- 3) Duplicate indexes: services, sub_services, kol_campaign_budget_allocations; drop extras if present.

-- ---------------------------------------------------------------------------
-- 1) sniping_images
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view images in same organization" ON public.sniping_images;
CREATE POLICY "Users can view images in same organization"
  ON public.sniping_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans AS smp
      JOIN public.profiles AS current_user_profile
        ON current_user_profile.user_id = (SELECT auth.uid())
      WHERE smp.id = sniping_images.social_media_plan_id
        AND current_user_profile.active_organization_id IS NOT NULL
        AND current_user_profile.active_organization_id = smp.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert images in same organization" ON public.sniping_images;
CREATE POLICY "Users can insert images in same organization"
  ON public.sniping_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM public.social_media_plans AS smp
      JOIN public.profiles AS current_user_profile
        ON current_user_profile.user_id = (SELECT auth.uid())
      WHERE smp.id = sniping_images.social_media_plan_id
        AND current_user_profile.active_organization_id IS NOT NULL
        AND current_user_profile.active_organization_id = smp.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update their own images" ON public.sniping_images;
CREATE POLICY "Users can update their own images"
  ON public.sniping_images
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = created_by)
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can delete their own images" ON public.sniping_images;
CREATE POLICY "Users can delete their own images"
  ON public.sniping_images
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = created_by);

-- ---------------------------------------------------------------------------
-- 2) services / sub_services — remove FOR ALL policies overlapping SELECT/INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "services_org" ON public.services;
DROP POLICY IF EXISTS "sub_services_org" ON public.sub_services;

-- ---------------------------------------------------------------------------
-- 3) Duplicate indexes (same column list as another index on the table)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_services_org;
DROP INDEX IF EXISTS public.idx_sub_services_org;
DROP INDEX IF EXISTS public.idx_sub_services_service;
DROP INDEX IF EXISTS public.idx_budget_allocation_campaign;
-- Common duplicate name if created outside repo (same as idx_product_knowledge_features_org on organization_id)
DROP INDEX IF EXISTS public.idx_product_knowledge_features_organization_id;
