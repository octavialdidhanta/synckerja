-- Attendance Rules — fresh demo + end-to-end verify (Synckerja org)
-- Run: npm run supabase:db:push:attendance-rules-fresh-demo
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a | OCTA: 001b6725-bf16-4a2f-81ae-8960cf86c46d

-- ===========================================================================
-- 0) CONTEXT
-- ===========================================================================
SELECT '--- RUN CONTEXT ---' AS section;
SELECT CURRENT_DATE AS verify_date,
       EXTRACT(DOW FROM CURRENT_DATE)::int AS pg_dow,
       public.pg_dow_to_app_dow(EXTRACT(DOW FROM CURRENT_DATE)::int) AS app_dow;

-- ===========================================================================
-- 1) CLEANUP — hapus data verify / absensi demo lama
-- ===========================================================================
DELETE FROM public.attendance_validations av
WHERE av.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND av.attendance_record_id IN (
    SELECT ar.id FROM public.attendance_records ar
    WHERE ar.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND ar.employee_id IN (
        '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
        '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid
      )
  );

DELETE FROM public.attendance_penalties ap
WHERE ap.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ap.employee_id IN (
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid
  );

DELETE FROM public.attendance_records ar
WHERE ar.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ar.employee_id IN (
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid
  );

DELETE FROM public.national_holidays nh
WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND nh.name ILIKE '%Attendance Rules%';

DELETE FROM public.office_locations ol
WHERE ol.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND (
    ol.name ILIKE '%Verify Attendance%'
    OR ol.name ILIKE '%Current Location%'
  );

-- ===========================================================================
-- 2) SEED — rules defaults + office + shift (Saturday override)
-- ===========================================================================
INSERT INTO public.attendance_rules_settings (
  organization_id,
  enforce_national_holidays,
  require_photo_checkin,
  require_photo_checkout,
  require_gps_accuracy,
  gps_accuracy_threshold_meters,
  default_max_radius_meters,
  auto_checkout_enabled,
  auto_checkout_time
)
VALUES (
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  true, true, true, false, 50, 100, false, '18:00'::time
)
ON CONFLICT (organization_id) DO UPDATE SET
  enforce_national_holidays = true,
  require_photo_checkin = true,
  require_photo_checkout = true,
  require_gps_accuracy = false,
  gps_accuracy_threshold_meters = 50,
  default_max_radius_meters = 100,
  auto_checkout_enabled = false,
  auto_checkout_time = '18:00'::time,
  updated_at = now();

INSERT INTO public.office_locations (
  id, organization_id, name, address, latitude, longitude, radius_meters, is_active
)
VALUES (
  'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'AR Fresh Demo HQ',
  'Grogol Jakarta Barat',
  -6.136758, 106.785000, 100, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_meters = EXCLUDED.radius_meters,
  is_active = true,
  updated_at = now();

-- Ensure OCTA shift assignment exists (reuse shift-flow IDs if present)
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

-- ===========================================================================
-- 3) Impersonate OCTA user for RPC auth (validate_attendance_comprehensive)
-- ===========================================================================
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

-- ===========================================================================
-- 4) VERIFY — structured test matrix (final SELECT is the report)
-- ===========================================================================
DROP TABLE IF EXISTS _ar_verify;
CREATE TEMP TABLE _ar_verify (
  test_id text PRIMARY KEY,
  description text NOT NULL,
  expected text NOT NULL,
  actual text NOT NULL,
  passed boolean NOT NULL
);

-- T01 settings row + three toggles true
INSERT INTO _ar_verify
SELECT
  'T01_settings_defaults',
  'Settings row exists; holidays + photo in/out default ON',
  'enforce=true, photo_in=true, photo_out=true',
  format(
    'enforce=%s photo_in=%s photo_out=%s',
    ars.enforce_national_holidays,
    ars.require_photo_checkin,
    ars.require_photo_checkout
  ),
  ars.enforce_national_holidays
    AND ars.require_photo_checkin
    AND ars.require_photo_checkout
FROM public.attendance_rules_settings ars
WHERE ars.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- T02 photo required blocks when face_image_data empty
INSERT INTO _ar_verify
SELECT
  'T02_photo_required_blocks',
  'require_photo_checkin=true + no face → can_attend false',
  'can_attend=false, photo_required=true',
  format('can_attend=%s photo_required=%s', v.can_attend, v.photo_required),
  v.can_attend IS FALSE AND v.photo_required IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  NULL, 20::numeric, false
) v;

-- T03 photo provided → can_attend true (baseline weekday, no holiday today)
INSERT INTO _ar_verify
SELECT
  'T03_photo_provided_ok',
  'face_image_data present + inside radius → can_attend true (non-holiday)',
  'can_attend=true, location_valid=true',
  format('can_attend=%s location_valid=%s schedule_valid=%s', v.can_attend, v.location_valid, v.schedule_valid),
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

-- T04 outside radius blocked
INSERT INTO _ar_verify
SELECT
  'T04_outside_radius',
  'Far coordinates outside 100m → location_valid false',
  'location_valid=false, can_attend=false',
  format('location_valid=%s can_attend=%s dist=%s', v.location_valid, v.can_attend, round(v.distance_meters::numeric, 1)),
  v.location_valid IS FALSE AND v.can_attend IS FALSE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.20, 106.90,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

-- T05 GPS accuracy enforced when enabled
UPDATE public.attendance_rules_settings
SET require_gps_accuracy = true, gps_accuracy_threshold_meters = 50
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO _ar_verify
SELECT
  'T05_gps_over_threshold',
  'require_gps_accuracy=true, accuracy 80m → gps_accuracy_valid false',
  'gps_accuracy_valid=false, can_attend=false',
  format('gps_accuracy_valid=%s can_attend=%s', v.gps_accuracy_valid, v.can_attend),
  v.gps_accuracy_valid IS FALSE AND v.can_attend IS FALSE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 80::numeric, false
) v;

UPDATE public.attendance_rules_settings
SET require_gps_accuracy = false
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- T06 holiday enforced blocks (insert holiday TODAY)
INSERT INTO public.national_holidays (
  organization_id, name, date, is_active, applies_to_attendance, country_code
)
VALUES (
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'AR Fresh Demo Holiday Today',
  CURRENT_DATE,
  true, true, 'ID'
);

UPDATE public.attendance_rules_settings
SET enforce_national_holidays = true
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO _ar_verify
SELECT
  'T06_holiday_enforced_blocks',
  'National holiday today + enforce ON → can_attend false, is_holiday true',
  'is_holiday=true, can_attend=false',
  format('is_holiday=%s can_attend=%s', v.is_holiday, v.can_attend),
  v.is_holiday IS TRUE AND v.can_attend IS FALSE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

-- T07 holiday toggle OFF allows (still need valid schedule/location)
UPDATE public.attendance_rules_settings
SET enforce_national_holidays = false
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO _ar_verify
SELECT
  'T07_holiday_toggle_off',
  'Same holiday but enforce OFF → can_attend true (is_holiday still true)',
  'is_holiday=true, can_attend=true',
  format('is_holiday=%s can_attend=%s', v.is_holiday, v.can_attend),
  v.is_holiday IS TRUE AND v.can_attend IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

DELETE FROM public.national_holidays nh
WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND nh.name = 'AR Fresh Demo Holiday Today';

UPDATE public.attendance_rules_settings
SET enforce_national_holidays = true
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- T08 shift override on Saturday (validate uses CURRENT_DATE)
INSERT INTO _ar_verify
SELECT
  'T08_shift_override_saturday',
  'Saturday + shift assignment → schedule_valid true (shift override)',
  'schedule_valid=true, schedule_source=shift',
  format('schedule_valid=%s source=%s app_dow=%s', v.schedule_valid, v.schedule_source, public.pg_dow_to_app_dow(EXTRACT(DOW FROM CURRENT_DATE)::int)),
  v.schedule_valid IS TRUE AND v.schedule_source = 'shift'
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v
WHERE public.pg_dow_to_app_dow(EXTRACT(DOW FROM CURRENT_DATE)::int) = 6;

-- If not Saturday in DB clock, verify via resolver only
INSERT INTO _ar_verify
SELECT
  'T08b_shift_resolver_saturday',
  'Resolver Sat 2026-06-21: source=shift, is_working_day may false (WSS)',
  'source=shift, shift_id not null',
  format('source=%s is_working_day=%s shift_id=%s', r.source, r.is_working_day, r.shift_id),
  r.source = 'shift' AND r.shift_id IS NOT NULL
FROM public.resolve_effective_schedule(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-21'::date
) r
WHERE CURRENT_DATE <> '2026-06-21'::date;

-- T08c/T08d: WSS Mon-Fri + shift override golden (backup/restore working_days)
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
  'T08c_shift_resolver_sat_monfri_wss',
  'WSS Mon-Fri + Sat 2026-06-21: resolver source=shift with active assignment',
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
  'T08d_shift_override_sched_ok',
  'RPC shift override logic: sched_ok true when shift assigned on non-WSS day',
  'sched_ok=true with is_working_day=false',
  format('is_working_day=%s source=%s sched_ok=%s', x.is_working_day, x.source, x.sched_ok),
  x.sched_ok IS TRUE
FROM (
  SELECT
    r.source,
    r.is_working_day,
    r.shift_id,
    r.employee_shift_id,
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

-- T09 radius fallback when office radius null
UPDATE public.office_locations SET radius_meters = NULL
WHERE id = 'd4d4d4d4-4444-4444-8444-444444444401'::uuid;

INSERT INTO _ar_verify
SELECT
  'T09_radius_fallback_100',
  'Office radius NULL → allowed_radius uses org default 100m',
  'allowed_radius=100, location_valid=true at HQ coords',
  format('allowed_radius=%s location_valid=%s', v.allowed_radius, v.location_valid),
  v.allowed_radius = 100 AND v.location_valid IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

UPDATE public.office_locations SET radius_meters = 100
WHERE id = 'd4d4d4d4-4444-4444-8444-444444444401'::uuid;

-- T10 checkout photo required
INSERT INTO public.attendance_records (
  id, employee_id, organization_id, attendance_date,
  check_in_time, check_in_at, status
)
VALUES (
  'e5e5e5e5-5555-4555-8555-555555555501'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  CURRENT_DATE,
  '08:05:00'::time, now(), 'present'
);

INSERT INTO _ar_verify
SELECT
  'T10_checkout_photo_required',
  'require_photo_checkout=true, no photo → can_checkout false',
  'can_checkout=false, photo_required=true',
  format('can_checkout=%s photo_required=%s photo_valid=%s', c.can_checkout, c.photo_required, c.photo_valid),
  c.can_checkout IS FALSE AND c.photo_required IS TRUE AND c.photo_valid IS FALSE
FROM public.validate_checkout_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  NULL, NULL
) c;

INSERT INTO _ar_verify
SELECT
  'T11_checkout_with_photo',
  'photo_path provided → can_checkout true',
  'can_checkout=true',
  format('can_checkout=%s', c.can_checkout),
  c.can_checkout IS TRUE
FROM public.validate_checkout_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'demo/checkout.jpg', NULL
) c;

-- T12 auto checkout function dry-run
INSERT INTO _ar_verify
SELECT
  'T12_auto_checkout_fn',
  'apply_attendance_auto_checkout exists and runs',
  'updated >= 0',
  format('result=%s', public.apply_attendance_auto_checkout('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid)::text),
  public.apply_attendance_auto_checkout('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid)->>'updated' IS NOT NULL;

-- T13 load_attendance_rules fallback when row exists
INSERT INTO _ar_verify
SELECT
  'T13_load_rules',
  'load_attendance_rules returns photo flags true',
  'photo_in=true, photo_out=true',
  format('in=%s out=%s', r.require_photo_checkin, r.require_photo_checkout),
  r.require_photo_checkin AND r.require_photo_checkout
FROM public.load_attendance_rules('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid) r;

-- ===========================================================================
-- 5) REPORT
-- ===========================================================================
SELECT '--- TEST RESULTS ---' AS section;
SELECT test_id, description, expected, actual, passed
FROM _ar_verify
ORDER BY test_id;

SELECT '--- SUMMARY ---' AS section;
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT passed) = 0 THEN 'ALL PASS' ELSE 'HAS FAILURES' END AS status
FROM _ar_verify;

SELECT jsonb_pretty(jsonb_agg(jsonb_build_object(
  'test_id', test_id,
  'passed', passed,
  'expected', expected,
  'actual', actual
) ORDER BY test_id)) AS full_report
FROM _ar_verify;

SELECT '--- FAILURES (if any) ---' AS section;
SELECT test_id, description, expected, actual
FROM _ar_verify
WHERE NOT passed
ORDER BY test_id;

-- Reset rules to production defaults for demo org
UPDATE public.attendance_rules_settings
SET
  enforce_national_holidays = true,
  require_photo_checkin = true,
  require_photo_checkout = true,
  require_gps_accuracy = false,
  auto_checkout_enabled = false
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- Cleanup today's test attendance row (keep office + settings)
DELETE FROM public.attendance_records
WHERE id = 'e5e5e5e5-5555-4555-8555-555555555501'::uuid;
