-- national_holidays + work_schedule_settings alignment with synckerja-reference (supabase types).
-- Fixes: national_holidays 404; work_schedule_settings.is_active (and related columns) missing.

-- ---------------------------------------------------------------------------
-- national_holidays (reference: types Row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.national_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  is_recurring boolean DEFAULT false,
  is_active boolean DEFAULT true,
  applies_to_attendance boolean DEFAULT true,
  recurring_type text,
  country_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_national_holidays_org_date ON public.national_holidays (organization_id, date);
CREATE INDEX IF NOT EXISTS idx_national_holidays_date ON public.national_holidays (date);

DROP TRIGGER IF EXISTS national_holidays_updated_at ON public.national_holidays;
CREATE TRIGGER national_holidays_updated_at
  BEFORE UPDATE ON public.national_holidays
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.national_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS national_holidays_select ON public.national_holidays;
CREATE POLICY national_holidays_select ON public.national_holidays FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS national_holidays_insert ON public.national_holidays;
CREATE POLICY national_holidays_insert ON public.national_holidays FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS national_holidays_update ON public.national_holidays;
CREATE POLICY national_holidays_update ON public.national_holidays FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS national_holidays_delete ON public.national_holidays;
CREATE POLICY national_holidays_delete ON public.national_holidays FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- work_schedule_settings: extend minimal 1-home stub to reference Row shape
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_schedule_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_schedule_settings
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Default',
  ADD COLUMN IF NOT EXISTS working_days integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  ADD COLUMN IF NOT EXISTS start_time text NOT NULL DEFAULT '09:00:00',
  ADD COLUMN IF NOT EXISTS end_time text NOT NULL DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS break_start_time text,
  ADD COLUMN IF NOT EXISTS break_end_time text,
  ADD COLUMN IF NOT EXISTS late_tolerance_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_threshold_minutes integer,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS work_schedule_settings_updated_at ON public.work_schedule_settings;
CREATE TRIGGER work_schedule_settings_updated_at
  BEFORE UPDATE ON public.work_schedule_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.work_schedule_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_schedule_settings_org_all ON public.work_schedule_settings;
CREATE POLICY work_schedule_settings_org_all ON public.work_schedule_settings FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE INDEX IF NOT EXISTS idx_work_schedule_settings_org_default
  ON public.work_schedule_settings (organization_id, is_default DESC)
  WHERE is_active = true;
