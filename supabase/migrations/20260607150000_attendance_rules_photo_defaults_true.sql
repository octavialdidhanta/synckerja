-- Default ON for national holidays + photo check-in/out for all tenants.

ALTER TABLE public.attendance_rules_settings
  ALTER COLUMN enforce_national_holidays SET DEFAULT true,
  ALTER COLUMN require_photo_checkin SET DEFAULT true,
  ALTER COLUMN require_photo_checkout SET DEFAULT true;

UPDATE public.attendance_rules_settings
SET
  enforce_national_holidays = true,
  require_photo_checkin = true,
  require_photo_checkout = true,
  updated_at = now();

INSERT INTO public.attendance_rules_settings (
  organization_id,
  enforce_national_holidays,
  require_photo_checkin,
  require_photo_checkout
)
SELECT o.id, true, true, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.attendance_rules_settings ars
  WHERE ars.organization_id = o.id
);

CREATE OR REPLACE FUNCTION public.load_attendance_rules(p_organization_id uuid)
RETURNS TABLE (
  enforce_national_holidays boolean,
  require_photo_checkin boolean,
  require_photo_checkout boolean,
  auto_checkout_enabled boolean,
  auto_checkout_time time,
  default_max_radius_meters integer,
  gps_accuracy_threshold_meters integer,
  require_gps_accuracy boolean,
  allow_manual_location boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ars.enforce_national_holidays, true),
    COALESCE(ars.require_photo_checkin, true),
    COALESCE(ars.require_photo_checkout, true),
    COALESCE(ars.auto_checkout_enabled, false),
    COALESCE(ars.auto_checkout_time, '18:00'::time),
    COALESCE(ars.default_max_radius_meters, 100),
    COALESCE(ars.gps_accuracy_threshold_meters, 50),
    COALESCE(ars.require_gps_accuracy, false),
    COALESCE(ars.allow_manual_location, false)
  FROM (SELECT 1) AS _dummy
  LEFT JOIN public.attendance_rules_settings ars
    ON ars.organization_id = p_organization_id;
$$;
