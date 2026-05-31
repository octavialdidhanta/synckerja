-- attendance_rules_settings: per-org attendance validation toggles (Phase 1)

CREATE TABLE IF NOT EXISTS public.attendance_rules_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  enforce_national_holidays boolean NOT NULL DEFAULT true,
  require_photo_checkin boolean NOT NULL DEFAULT true,
  require_photo_checkout boolean NOT NULL DEFAULT true,
  auto_checkout_enabled boolean NOT NULL DEFAULT false,
  auto_checkout_time time NOT NULL DEFAULT '18:00'::time,
  default_max_radius_meters integer NOT NULL DEFAULT 100,
  gps_accuracy_threshold_meters integer NOT NULL DEFAULT 50,
  require_gps_accuracy boolean NOT NULL DEFAULT false,
  allow_manual_location boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_rules_settings_organization_id_key UNIQUE (organization_id),
  CONSTRAINT attendance_rules_settings_default_max_radius_positive CHECK (default_max_radius_meters > 0),
  CONSTRAINT attendance_rules_settings_gps_threshold_positive CHECK (gps_accuracy_threshold_meters > 0)
);

CREATE INDEX IF NOT EXISTS idx_attendance_rules_settings_organization_id
  ON public.attendance_rules_settings (organization_id);

DROP TRIGGER IF EXISTS attendance_rules_settings_updated_at ON public.attendance_rules_settings;
CREATE TRIGGER attendance_rules_settings_updated_at
  BEFORE UPDATE ON public.attendance_rules_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.attendance_rules_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_rules_settings_org_all ON public.attendance_rules_settings;
CREATE POLICY attendance_rules_settings_org_all ON public.attendance_rules_settings FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- Demo org seed (Synckerja)
INSERT INTO public.attendance_rules_settings (organization_id)
VALUES ('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid)
ON CONFLICT (organization_id) DO NOTHING;
