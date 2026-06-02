-- Performance Advisor: Auth RLS Initialization Plan
-- Wrap auth.uid() in a scalar subquery so it runs once per query instead of per-row.

-- ---------------------------------------------------------------------------
-- Instagram conversation cycles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "instagram_conversation_cycles_select" ON public.instagram_conversation_cycles;
CREATE POLICY "instagram_conversation_cycles_select"
  ON public.instagram_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.instagram_conversations c
      JOIN public.profiles p
        ON p.active_organization_id = c.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE c.id = instagram_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "instagram_conversation_cycles_insert" ON public.instagram_conversation_cycles;
CREATE POLICY "instagram_conversation_cycles_insert"
  ON public.instagram_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.instagram_conversations c
      JOIN public.profiles p
        ON p.active_organization_id = c.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE c.id = instagram_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "instagram_conversation_cycles_update" ON public.instagram_conversation_cycles;
CREATE POLICY "instagram_conversation_cycles_update"
  ON public.instagram_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.instagram_conversations c
      JOIN public.profiles p
        ON p.active_organization_id = c.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE c.id = instagram_conversation_cycles.conversation_id
    )
  );

-- ---------------------------------------------------------------------------
-- Email conversation cycles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_conversation_cycles_select" ON public.email_conversation_cycles;
CREATE POLICY "email_conversation_cycles_select"
  ON public.email_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_conversations c
      JOIN public.profiles p
        ON p.active_organization_id = c.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE c.id = email_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "email_conversation_cycles_insert" ON public.email_conversation_cycles;
CREATE POLICY "email_conversation_cycles_insert"
  ON public.email_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.email_conversations c
      JOIN public.profiles p
        ON p.active_organization_id = c.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE c.id = email_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "email_conversation_cycles_update" ON public.email_conversation_cycles;
CREATE POLICY "email_conversation_cycles_update"
  ON public.email_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_conversations c
      JOIN public.profiles p
        ON p.active_organization_id = c.organization_id
       AND p.user_id = (SELECT auth.uid())
      WHERE c.id = email_conversation_cycles.conversation_id
    )
  );

-- ---------------------------------------------------------------------------
-- Customer survey: per-assignee targets table
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS customer_survey_assignee_targets_select ON public.organization_customer_survey_assignee_targets;
CREATE POLICY customer_survey_assignee_targets_select
  ON public.organization_customer_survey_assignee_targets
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- Daily task push queues (debug read own)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "daily_task_assignment_push_queue_select_own" ON public.daily_task_assignment_push_queue;
CREATE POLICY "daily_task_assignment_push_queue_select_own"
  ON public.daily_task_assignment_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "daily_task_completion_push_queue_select_own" ON public.daily_task_completion_push_queue;
CREATE POLICY "daily_task_completion_push_queue_select_own"
  ON public.daily_task_completion_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Social media production notifications (own rows)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "social_media_production_notifications_select_own" ON public.social_media_production_notifications;
CREATE POLICY "social_media_production_notifications_select_own"
  ON public.social_media_production_notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "social_media_production_notifications_update_own" ON public.social_media_production_notifications;
CREATE POLICY "social_media_production_notifications_update_own"
  ON public.social_media_production_notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "social_media_production_push_queue_select_own" ON public.social_media_production_push_queue;
CREATE POLICY "social_media_production_push_queue_select_own"
  ON public.social_media_production_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = (SELECT auth.uid()));

