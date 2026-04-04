-- Performance Advisor: Auth RLS Initialization Plan
-- Use (SELECT auth.uid()) in policies (see Supabase RLS docs) or avoid auth.* in policy text via user_organization_ids().
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- Timestamp after organization_script_ai_config + product_knowledge_* tables.

-- ---------------------------------------------------------------------------
-- review_comment_notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own review comment notifications" ON public.review_comment_notifications;
CREATE POLICY "Users can view own review comment notifications"
  ON public.review_comment_notifications FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own review comment notifications (read_at)" ON public.review_comment_notifications;
CREATE POLICY "Users can update own review comment notifications (read_at)"
  ON public.review_comment_notifications FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- organization_script_ai_config
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can view own org script ai config"
  ON public.organization_script_ai_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_script_ai_config.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can insert own org script ai config"
  ON public.organization_script_ai_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can update own org script ai config"
  ON public.organization_script_ai_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_script_ai_config.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can delete own org script ai config"
  ON public.organization_script_ai_config FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_script_ai_config.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- script_ai_daily_usage
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own org script ai usage" ON public.script_ai_daily_usage;
CREATE POLICY "Users can view own org script ai usage"
  ON public.script_ai_daily_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = script_ai_daily_usage.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org script ai usage" ON public.script_ai_daily_usage;
CREATE POLICY "Users can insert own org script ai usage"
  ON public.script_ai_daily_usage FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org script ai usage" ON public.script_ai_daily_usage;
CREATE POLICY "Users can update own org script ai usage"
  ON public.script_ai_daily_usage FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = script_ai_daily_usage.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- product_knowledge_style / hooks / features: drop all existing policies, one org-scoped policy each
-- (avoids auth.uid() in policy text; user_organization_ids() uses (SELECT auth.uid()) internally per 20260430140000)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.product_knowledge_style') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_knowledge_style'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_knowledge_style', pol.policyname);
    END LOOP;
    EXECUTE $sql$
      CREATE POLICY "product_knowledge_style_org" ON public.product_knowledge_style
        FOR ALL TO authenticated
        USING (organization_id IN (SELECT public.user_organization_ids()))
        WITH CHECK (organization_id IN (SELECT public.user_organization_ids()))
    $sql$;
  END IF;

  IF to_regclass('public.product_knowledge_hooks') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_knowledge_hooks'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_knowledge_hooks', pol.policyname);
    END LOOP;
    EXECUTE $sql$
      CREATE POLICY "product_knowledge_hooks_org" ON public.product_knowledge_hooks
        FOR ALL TO authenticated
        USING (organization_id IN (SELECT public.user_organization_ids()))
        WITH CHECK (organization_id IN (SELECT public.user_organization_ids()))
    $sql$;
  END IF;

  IF to_regclass('public.product_knowledge_features') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_knowledge_features'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_knowledge_features', pol.policyname);
    END LOOP;
    EXECUTE $sql$
      CREATE POLICY "product_knowledge_features_org" ON public.product_knowledge_features
        FOR ALL TO authenticated
        USING (organization_id IN (SELECT public.user_organization_ids()))
        WITH CHECK (organization_id IN (SELECT public.user_organization_ids()))
    $sql$;
  END IF;
END;
$$;
