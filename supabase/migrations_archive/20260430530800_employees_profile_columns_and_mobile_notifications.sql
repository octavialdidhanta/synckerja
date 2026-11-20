-- Mobile profile (useProfile) + notification tables used by main-app-port / 6-1-dashboard hooks.
-- Fixes: employees.mobile_phone does not exist; daily_task_notifications / plan_status_change_notifications 404.

-- ---------------------------------------------------------------------------
-- employees: columns referenced by mobile Profile / HR UI
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS mobile_phone text NULL,
  ADD COLUMN IF NOT EXISTS address text NULL,
  ADD COLUMN IF NOT EXISTS join_date date NULL;

COMMENT ON COLUMN public.employees.mobile_phone IS 'Contact phone for employee profile (mobile app / HR).';
COMMENT ON COLUMN public.employees.address IS 'Residential or mailing address.';
COMMENT ON COLUMN public.employees.join_date IS 'Employment start date for display.';

-- ---------------------------------------------------------------------------
-- plan_status_change_notifications (usePlanStatusChangeNotifications)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_status_change_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_title text NULL,
  change_kind text NULL,
  old_value text NULL,
  new_value text NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_status_change_notifications_user_org
  ON public.plan_status_change_notifications (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_plan_status_change_notifications_user_read
  ON public.plan_status_change_notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_plan_status_change_notifications_created_at
  ON public.plan_status_change_notifications (created_at DESC);

ALTER TABLE public.plan_status_change_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_status_change_notifications_select_own" ON public.plan_status_change_notifications;
CREATE POLICY "plan_status_change_notifications_select_own"
  ON public.plan_status_change_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "plan_status_change_notifications_update_own" ON public.plan_status_change_notifications;
CREATE POLICY "plan_status_change_notifications_update_own"
  ON public.plan_status_change_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_plan_status_change_notifications_read(notification_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF notification_ids IS NULL OR array_length(notification_ids, 1) IS NULL THEN
    UPDATE public.plan_status_change_notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND read_at IS NULL;
  ELSE
    UPDATE public.plan_status_change_notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND id = ANY (notification_ids);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_plan_status_change_notifications_read(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_plan_status_change_notifications_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_plan_status_change_notifications_read(uuid[]) TO service_role;

COMMENT ON TABLE public.plan_status_change_notifications IS 'In-app notifications when a social media plan status changes.';
COMMENT ON FUNCTION public.mark_plan_status_change_notifications_read(uuid[]) IS 'Mark plan status change notifications read for the current user.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_status_change_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- daily_task_notifications (useDailyTaskNotifications, useNotificationBadgeCount)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_task_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NULL,
  daily_task_id uuid NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  task_step_id uuid NULL,
  task_steps_to_steps_id uuid NULL,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_task_notifications_user_org
  ON public.daily_task_notifications (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_daily_task_notifications_user_read
  ON public.daily_task_notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_daily_task_notifications_created_at
  ON public.daily_task_notifications (created_at DESC);

ALTER TABLE public.daily_task_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_task_notifications_select_own" ON public.daily_task_notifications;
CREATE POLICY "daily_task_notifications_select_own"
  ON public.daily_task_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_task_notifications_update_own" ON public.daily_task_notifications;
CREATE POLICY "daily_task_notifications_update_own"
  ON public.daily_task_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.daily_task_notifications IS 'In-app notifications for daily task activity (mobile bell / tasks tab).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_task_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
