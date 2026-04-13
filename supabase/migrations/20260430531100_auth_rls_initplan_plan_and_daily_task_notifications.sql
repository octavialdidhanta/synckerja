-- Performance Advisor: Auth RLS Initialization Plan
-- Wrap auth.uid() as (SELECT auth.uid()) so auth calls are not re-evaluated per row.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Tables: plan_status_change_notifications, daily_task_notifications
-- (originally defined in 20260430530800_employees_profile_columns_and_mobile_notifications.sql)

-- ---------------------------------------------------------------------------
-- plan_status_change_notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "plan_status_change_notifications_select_own" ON public.plan_status_change_notifications;
CREATE POLICY "plan_status_change_notifications_select_own"
  ON public.plan_status_change_notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plan_status_change_notifications_update_own" ON public.plan_status_change_notifications;
CREATE POLICY "plan_status_change_notifications_update_own"
  ON public.plan_status_change_notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- daily_task_notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "daily_task_notifications_select_own" ON public.daily_task_notifications;
CREATE POLICY "daily_task_notifications_select_own"
  ON public.daily_task_notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "daily_task_notifications_update_own" ON public.daily_task_notifications;
CREATE POLICY "daily_task_notifications_update_own"
  ON public.daily_task_notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
