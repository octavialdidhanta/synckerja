-- Performance Advisor: "Multiple Permissive Policies" on public.work_schedule_settings
-- Drop every RLS policy on the table (removes duplicates from home DO-loop + follow-up migrations),
-- then recreate a single FOR ALL policy for org members.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_schedule_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.work_schedule_settings', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.work_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_schedule_settings_org_all
  ON public.work_schedule_settings
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
