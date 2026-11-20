-- Performance Advisor fixes (lint 0003 auth_rls_initplan, 0001 unindexed_foreign_keys, 0009 duplicate_index).
--
-- 1) RLS initplan: 60 policies call auth.uid() directly, so Postgres re-evaluates it
--    for every row. Wrapping it as (SELECT auth.uid()) lets the planner evaluate it once
--    per query. The predicate is logically identical; only the evaluation strategy changes.
--    The DO block touches exactly the 60 (table, policy) pairs listed and aborts if any
--    is missing or if a policy no longer matches the expected shape.
-- 2) Covering indexes for 31 foreign keys on tables that are large or grow with usage
--    (messages, queues, stock movements, runs, plans). The remaining ~420 unindexed FKs
--    are on tiny/config tables and are intentionally left alone.
-- 3) Drop one of two identical indexes on lead_magnet_campaign_accounts (platform, account_id).
--
-- Rollback: supabase/rollback/20261120_perf_advisor_rollback.sql

SET LOCAL search_path = public, extensions, pg_temp;

DO $$
DECLARE
  r record;
  v_using text;
  v_check text;
  v_sql text;
  v_done int := 0;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname, p.qual, p.with_check
    FROM (VALUES
    ('ai_employee_feedback','ai_employee_feedback_insert'),
    ('ai_employee_permissions','ai_employee_permissions_write'),
    ('ai_employee_profiles','ai_employee_profiles_write'),
    ('ai_employee_schedules','ai_employee_schedules_write'),
    ('ai_employee_sop_steps','ai_employee_sop_steps_write'),
    ('ai_employee_sops','ai_employee_sops_write'),
    ('auth_security_events','auth_security_events_insert_own'),
    ('auth_security_events','auth_security_events_select_own'),
    ('claude_pdf_daily_usage','Users can view own org claude pdf usage'),
    ('employee_payroll_paid_announcements','payroll_paid_announcements_own_dismiss'),
    ('employee_payroll_paid_announcements','payroll_paid_announcements_own_select'),
    ('facebook_conversation_cycles','facebook_conversation_cycles_insert'),
    ('facebook_conversation_cycles','facebook_conversation_cycles_select'),
    ('facebook_conversation_cycles','facebook_conversation_cycles_update'),
    ('facebook_conversation_status_history','Users can insert own org facebook conversation status history'),
    ('facebook_conversation_status_history','Users can view own org facebook conversation status history'),
    ('facebook_conversations','Users can insert own org facebook conversations'),
    ('facebook_conversations','Users can update own org facebook conversations'),
    ('facebook_conversations','Users can view own org facebook conversations'),
    ('facebook_messages','Users can insert own org facebook messages'),
    ('facebook_messages','Users can update own org facebook messages'),
    ('facebook_messages','Users can view own org facebook messages'),
    ('organization_blibli_seller_connections','organization_blibli_seller_connections_select'),
    ('organization_caption_hashtags','Users can delete own org caption hashtags'),
    ('organization_caption_hashtags','Users can insert own org caption hashtags'),
    ('organization_caption_hashtags','Users can update own org caption hashtags'),
    ('organization_caption_hashtags','Users can view own org caption hashtags'),
    ('organization_caption_mention_handles','Users can delete own org caption mention handles'),
    ('organization_caption_mention_handles','Users can insert own org caption mention handles'),
    ('organization_caption_mention_handles','Users can update own org caption mention handles'),
    ('organization_caption_mention_handles','Users can view own org caption mention handles'),
    ('organization_facebook_pages','Users can insert own org facebook pages'),
    ('organization_facebook_pages','Users can update own org facebook pages'),
    ('organization_facebook_pages','Users can view own org facebook pages'),
    ('organization_video_ai_config','Users can insert own org video ai config'),
    ('organization_video_ai_config','Users can update own org video ai config'),
    ('organization_video_ai_config','Users can view own org video ai config'),
    ('organization_voice_ai_config','Users can insert own org voice ai config'),
    ('organization_voice_ai_config','Users can update own org voice ai config'),
    ('organization_voice_ai_config','Users can view own org voice ai config'),
    ('task_step_comment_push_queue','task_step_comment_push_queue_select_own'),
    ('threads_conversation_cycles','threads_conversation_cycles_insert'),
    ('threads_conversation_cycles','threads_conversation_cycles_select'),
    ('threads_conversation_cycles','threads_conversation_cycles_update'),
    ('threads_conversations','Users can insert own org threads conversations'),
    ('threads_conversations','Users can update own org threads conversations'),
    ('threads_conversations','Users can view own org threads conversations'),
    ('threads_dm_conversation_cycles','threads_dm_conversation_cycles_select'),
    ('threads_dm_conversations','threads_dm_conversations_insert'),
    ('threads_dm_conversations','threads_dm_conversations_select'),
    ('threads_dm_conversations','threads_dm_conversations_update'),
    ('threads_dm_messages','threads_dm_messages_insert'),
    ('threads_dm_messages','threads_dm_messages_select'),
    ('threads_dm_messages','threads_dm_messages_update'),
    ('threads_messages','Users can insert own org threads messages'),
    ('threads_messages','Users can update own org threads messages'),
    ('threads_messages','Users can view own org threads messages'),
    ('user_mfa_recovery_codes','user_mfa_recovery_codes_select_own'),
    ('video_ai_daily_usage','Users can view own org video ai usage'),
    ('voice_ai_daily_usage','Users can view own org voice ai usage')
    ) AS t(tablename, policyname)
    JOIN pg_policies p
      ON p.schemaname = 'public' AND p.tablename = t.tablename AND p.policyname = t.policyname
  LOOP
    IF coalesce(r.qual, '') || coalesce(r.with_check, '') ~ 'SELECT auth\.uid\(\)' THEN
      RAISE EXCEPTION 'policy %.% already wrapped; aborting', r.tablename, r.policyname;
    END IF;
    v_using := replace(r.qual, 'auth.uid()', '(SELECT auth.uid())');
    v_check := replace(r.with_check, 'auth.uid()', '(SELECT auth.uid())');
    v_sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
    v_done := v_done + 1;
  END LOOP;

  IF v_done <> 60 THEN
    RAISE EXCEPTION 'expected 60 policies, rewrote %; aborting', v_done;
  END IF;
END $$;

-- Foreign-key covering indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_automation_flow_id ON public.whatsapp_messages (automation_flow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_automation_enrollment_id ON public.whatsapp_messages (automation_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_auth_user_id ON public.analytics_sessions (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_content_ai_usage_organization_id ON public.content_ai_usage (organization_id);
CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_scheduled_by ON public.social_media_scheduled_posts (scheduled_by);
CREATE INDEX IF NOT EXISTS idx_daily_task_notifications_organization_id ON public.daily_task_notifications (organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_notifications_daily_task_id ON public.daily_task_notifications (daily_task_id);
CREATE INDEX IF NOT EXISTS idx_catalog_stock_movements_outlet_id ON public.catalog_stock_movements (outlet_id);
CREATE INDEX IF NOT EXISTS idx_catalog_stock_movements_ingredient_id ON public.catalog_stock_movements (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_catalog_stock_movements_product_id ON public.catalog_stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_stock_movements_variant_id ON public.catalog_stock_movements (variant_id);
CREATE INDEX IF NOT EXISTS idx_ai_employee_runs_job_id ON public.ai_employee_runs (job_id);
CREATE INDEX IF NOT EXISTS idx_ai_employee_runs_organization_id ON public.ai_employee_runs (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_employee_runs_employee_id_organization_id ON public.ai_employee_runs (employee_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_social_media_plans_pic_id ON public.social_media_plans (pic_id);
CREATE INDEX IF NOT EXISTS idx_social_media_plans_pic_production_id ON public.social_media_plans (pic_production_id);
CREATE INDEX IF NOT EXISTS idx_social_media_plans_thinking_idea_id ON public.social_media_plans (thinking_idea_id);
CREATE INDEX IF NOT EXISTS idx_social_media_plans_product_knowledge_id ON public.social_media_plans (product_knowledge_id);
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_lead_status_id ON public.instagram_conversations (lead_status_id);
CREATE INDEX IF NOT EXISTS idx_facebook_conversations_lead_status_id ON public.facebook_conversations (lead_status_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_assignment_push_queue_daily_task_id ON public.daily_task_assignment_push_queue (daily_task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_completion_push_queue_daily_task_id ON public.daily_task_completion_push_queue (daily_task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_completion_push_queue_organization_id ON public.daily_task_completion_push_queue (organization_id);
CREATE INDEX IF NOT EXISTS idx_task_step_comment_push_queue_organization_id ON public.task_step_comment_push_queue (organization_id);
CREATE INDEX IF NOT EXISTS idx_task_step_comment_push_queue_daily_task_id ON public.task_step_comment_push_queue (daily_task_id);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_enrollments_lead_submission_id ON public.lead_magnet_enrollments (lead_submission_id);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_enrollments_lead_id ON public.lead_magnet_enrollments (lead_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_movements_sku_id ON public.inventory_stock_movements (sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_order_deductions_sku_id ON public.inventory_order_deductions (sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_order_deductions_movement_id ON public.inventory_order_deductions (movement_id);
CREATE INDEX IF NOT EXISTS idx_omnichannel_flow_run_events_enrollment_id ON public.omnichannel_flow_run_events (enrollment_id);

-- Identical duplicate of idx_lead_magnet_campaign_accounts_lookup (platform, account_id)
DROP INDEX IF EXISTS public.idx_lead_magnet_campaign_accounts_active_lookup;
