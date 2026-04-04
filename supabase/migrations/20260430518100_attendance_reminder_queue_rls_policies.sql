-- Security Advisor: RLS enabled on attendance_reminder_queue but no policies.
-- Queue is written/read only by Edge Functions (service role), which bypasses RLS.
-- Explicit deny policies for API roles document intent and satisfy the linter.

DROP POLICY IF EXISTS "attendance_reminder_queue_no_anon" ON public.attendance_reminder_queue;
CREATE POLICY "attendance_reminder_queue_no_anon"
  ON public.attendance_reminder_queue
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "attendance_reminder_queue_no_authenticated" ON public.attendance_reminder_queue;
CREATE POLICY "attendance_reminder_queue_no_authenticated"
  ON public.attendance_reminder_queue
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
