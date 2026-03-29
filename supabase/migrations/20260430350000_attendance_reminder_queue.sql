-- Queue for attendance reminder push notifications (FCM).
-- Filled by attendance-reminder-fill-queue; consumed by attendance-reminder-send.
CREATE TABLE IF NOT EXISTS public.attendance_reminder_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('shift', 'work_schedule')),
  schedule_id uuid NOT NULL,
  schedule_name text NOT NULL,
  start_time text NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('before_30m', 'before_15m', 'after_15m', 'after_30m')),
  effective_date date NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, effective_date, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_attendance_reminder_queue_pending
  ON public.attendance_reminder_queue (scheduled_at)
  WHERE sent_at IS NULL;

COMMENT ON TABLE public.attendance_reminder_queue IS 'Queue for attendance reminder FCM push: filled by fill-queue, sent by attendance-reminder-send.';

ALTER TABLE public.attendance_reminder_queue ENABLE ROW LEVEL SECURITY;
