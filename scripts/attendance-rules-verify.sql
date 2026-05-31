-- Attendance Rules — CI verify (JWT + assert matrix)
-- Run: npm run supabase:db:push:attendance-rules-verify
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a | OCTA: 001b6725-bf16-4a2f-81ae-8960cf86c46d

SELECT '--- RUN CONTEXT ---' AS section;
SELECT CURRENT_DATE AS verify_date,
       EXTRACT(DOW FROM CURRENT_DATE)::int AS pg_dow,
       public.pg_dow_to_app_dow(EXTRACT(DOW FROM CURRENT_DATE)::int) AS app_dow;

-- Minimal seed: settings + office + shift assignment
INSERT INTO public.attendance_rules_settings (organization_id)
VALUES ('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid)
ON CONFLICT (organization_id) DO NOTHING;

UPDATE public.attendance_rules_settings
SET
  enforce_national_holidays = true,
  require_photo_checkin = true,
  require_photo_checkout = true,
  require_gps_accuracy = false,
  gps_accuracy_threshold_meters = 50,
  default_max_radius_meters = 100
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO public.office_locations (
  id, organization_id, name, address, latitude, longitude, radius_meters, is_active
)
VALUES (
  'c3c3c3c3-3333-4333-8333-333333333301'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Kantor Verify Attendance Rules',
  'Demo HQ — Grogol, Jakarta Barat',
  -6.136758, 106.785000, 100, true
)
ON CONFLICT (id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_meters = EXCLUDED.radius_meters,
  is_active = true,
  updated_at = now();

INSERT INTO public.shifts (
  id, organization_id, name, start_time, end_time,
  break_duration_minutes, late_tolerance_minutes, is_active
)
VALUES (
  'f1f1f1f1-1111-4111-8111-111111111101'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Shift Pagi Verify',
  '08:00', '17:00', 60, 15, true
)
ON CONFLICT (id) DO UPDATE SET is_active = true, updated_at = now();

INSERT INTO public.employee_shifts (
  id, organization_id, employee_id, shift_id,
  effective_from_date, effective_to_date, is_active
)
VALUES (
  'f2f2f2f2-2222-4222-8222-222222222201'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'f1f1f1f1-1111-4111-8111-111111111101'::uuid,
  '2026-01-01', NULL, true
)
ON CONFLICT (id) DO UPDATE SET is_active = true, updated_at = now();

DO $$
DECLARE
  v_user uuid;
BEGIN
  SELECT e.user_id INTO v_user
  FROM public.employees e
  WHERE e.id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid;
  IF v_user IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  END IF;
END $$;

DROP TABLE IF EXISTS _ar_verify;
CREATE TEMP TABLE _ar_verify (
  test_id text PRIMARY KEY,
  description text NOT NULL,
  expected text NOT NULL,
  actual text NOT NULL,
  passed boolean NOT NULL
);

INSERT INTO _ar_verify
SELECT
  'V01_settings_defaults',
  'Settings row: holidays + photo in/out ON',
  'enforce=true, photo_in=true, photo_out=true',
  format('enforce=%s photo_in=%s photo_out=%s', ars.enforce_national_holidays, ars.require_photo_checkin, ars.require_photo_checkout),
  ars.enforce_national_holidays AND ars.require_photo_checkin AND ars.require_photo_checkout
FROM public.attendance_rules_settings ars
WHERE ars.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO _ar_verify
SELECT
  'V02_photo_required_blocks',
  'No face_image_data → can_attend false',
  'can_attend=false, photo_required=true',
  format('can_attend=%s photo_required=%s', v.can_attend, v.photo_required),
  v.can_attend IS FALSE AND v.photo_required IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000, NULL, 20::numeric, false
) v;

INSERT INTO _ar_verify
SELECT
  'V03_photo_provided_ok',
  'face_image_data + inside radius → can_attend true (non-holiday)',
  'can_attend=true, location_valid=true',
  format('can_attend=%s location_valid=%s', v.can_attend, v.location_valid),
  v.can_attend IS TRUE AND v.location_valid IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v
WHERE NOT EXISTS (
  SELECT 1 FROM public.national_holidays nh
  WHERE nh.date = CURRENT_DATE
    AND COALESCE(nh.is_active, true)
    AND COALESCE(nh.applies_to_attendance, true)
    AND (nh.organization_id IS NULL OR nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid)
);

INSERT INTO _ar_verify
SELECT
  'V04_outside_radius',
  'Far coords → location_valid false',
  'location_valid=false',
  format('location_valid=%s dist=%s', v.location_valid, round(v.distance_meters::numeric, 1)),
  v.location_valid IS FALSE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.20, 106.90,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

UPDATE public.attendance_rules_settings
SET require_gps_accuracy = true
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO _ar_verify
SELECT
  'V05_gps_over_threshold',
  'GPS accuracy 80m > threshold 50m → blocked',
  'gps_accuracy_valid=false',
  format('gps_accuracy_valid=%s can_attend=%s', v.gps_accuracy_valid, v.can_attend),
  v.gps_accuracy_valid IS FALSE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 80::numeric, false
) v;

UPDATE public.attendance_rules_settings
SET require_gps_accuracy = false
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

UPDATE public.office_locations SET radius_meters = NULL
WHERE id = 'c3c3c3c3-3333-4333-8333-333333333301'::uuid;

INSERT INTO _ar_verify
SELECT
  'V06_radius_fallback',
  'Office radius NULL → allowed_radius=100',
  'allowed_radius=100, location_valid=true',
  format('allowed_radius=%s location_valid=%s', v.allowed_radius, v.location_valid),
  v.allowed_radius = 100 AND v.location_valid IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

UPDATE public.office_locations SET radius_meters = 100
WHERE id = 'c3c3c3c3-3333-4333-8333-333333333301'::uuid;

INSERT INTO _ar_verify
SELECT
  'V07_checkout_no_photo',
  'Checkout without photo → can_checkout false',
  'can_checkout=false, photo_required=true',
  format('can_checkout=%s photo_required=%s', c.can_checkout, c.photo_required),
  c.can_checkout IS FALSE AND c.photo_required IS TRUE
FROM public.validate_checkout_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  NULL, NULL
) c;

INSERT INTO _ar_verify
SELECT
  'V08_checkout_with_photo',
  'Checkout with photo_path → photo_valid true',
  'photo_valid=true',
  format('photo_valid=%s can_checkout=%s', c.photo_valid, c.can_checkout),
  c.photo_valid IS TRUE
FROM public.validate_checkout_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '001b6725/check_out_verify.jpg',
  'data:image/jpeg;base64,ZmFrZQ=='
) c;

INSERT INTO _ar_verify
SELECT
  'V09_load_rules',
  'load_attendance_rules photo flags true',
  'photo_in=true, photo_out=true',
  format('in=%s out=%s', r.require_photo_checkin, r.require_photo_checkout),
  r.require_photo_checkin AND r.require_photo_checkout
FROM public.load_attendance_rules('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid) r;

INSERT INTO _ar_verify
SELECT
  'V10_rpc_columns',
  'validate returns gps_accuracy_valid, photo_required, rules snapshot',
  'has_rules_snapshot=true',
  format('gps_ok=%s photo_req=%s snapshot=%s', v.gps_accuracy_valid, v.photo_required, v.attendance_rules_snapshot IS NOT NULL),
  v.attendance_rules_snapshot IS NOT NULL
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

-- Shift golden (WSS Mon-Fri backup)
DROP TABLE IF EXISTS _ar_wss_backup;
CREATE TEMP TABLE _ar_wss_backup AS
SELECT wss.id, wss.working_days
FROM public.work_schedule_settings wss
JOIN public.employees e ON e.work_schedule_id = wss.id
WHERE e.id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid;

UPDATE public.work_schedule_settings wss
SET working_days = ARRAY[1, 2, 3, 4, 5]::int[], updated_at = now()
FROM public.employees e
WHERE e.id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  AND wss.id = e.work_schedule_id;

INSERT INTO _ar_verify
SELECT
  'V11_shift_resolver_sat',
  'Sat 2026-06-21 WSS Mon-Fri: source=shift with active assignment',
  'source=shift, shift_id set',
  format('source=%s is_working_day=%s shift_id=%s', r.source, r.is_working_day, r.shift_id),
  r.source = 'shift' AND r.shift_id IS NOT NULL
FROM public.resolve_effective_schedule(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-21'::date
) r;

INSERT INTO _ar_verify
SELECT
  'V12_shift_override_sched_ok',
  'Shift override: sched_ok true on non-WSS Saturday',
  'sched_ok=true',
  format('sched_ok=%s is_working_day=%s', x.sched_ok, x.is_working_day),
  x.sched_ok IS TRUE
FROM (
  SELECT
    r.is_working_day,
    CASE
      WHEN NOT COALESCE(r.is_working_day, false)
           AND r.source = 'shift'
           AND r.shift_id IS NOT NULL
           AND r.employee_shift_id IS NOT NULL
      THEN true
      ELSE COALESCE(r.is_working_day, false)
    END AS sched_ok
  FROM public.resolve_effective_schedule(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-21'::date
  ) r
) x;

UPDATE public.work_schedule_settings wss
SET working_days = b.working_days, updated_at = now()
FROM _ar_wss_backup b
WHERE wss.id = b.id;

DROP TABLE IF EXISTS _ar_wss_backup;

SELECT '--- SUMMARY ---' AS section;
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT passed) = 0 THEN 'ALL PASS' ELSE 'HAS FAILURES' END AS status
FROM _ar_verify;

SELECT '--- FAILURES (if any) ---' AS section;
SELECT test_id, description, expected, actual
FROM _ar_verify
WHERE NOT passed
ORDER BY test_id;

SELECT jsonb_pretty(jsonb_agg(jsonb_build_object(
  'test_id', test_id,
  'passed', passed,
  'expected', expected,
  'actual', actual
) ORDER BY test_id)) AS full_report
FROM _ar_verify;
