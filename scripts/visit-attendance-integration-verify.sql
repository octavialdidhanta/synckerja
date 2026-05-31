-- Visit–Attendance Integration — verify matrix (linked demo org)
-- Run: npm run verify:visit-attendance-integration
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a | OCTA: 001b6725-bf16-4a2f-81ae-8960cf86c46d

SELECT '--- RUN CONTEXT ---' AS section;
SELECT CURRENT_DATE AS verify_date;

-- Ensure integration settings enabled
UPDATE public.attendance_rules_settings
SET
  enable_visit_attendance_integration = true,
  travel_threshold_minutes = 90,
  field_first_overlap_minutes = 30,
  urban_travel_speed_kmh = 35
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

INSERT INTO public.attendance_rules_settings (organization_id)
VALUES ('663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid)
ON CONFLICT (organization_id) DO NOTHING;

-- HQ office for travel estimates
INSERT INTO public.office_locations (
  id, organization_id, name, address, latitude, longitude, radius_meters, is_active, is_client_location
)
VALUES (
  'c3c3c3c3-3333-4333-8333-333333333301'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Kantor Verify Visit Attendance',
  'Demo HQ — Grogol, Jakarta Barat',
  -6.136758, 106.785000, 100, true, false
)
ON CONFLICT (id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  is_client_location = false,
  is_active = true,
  updated_at = now();

-- Near client site (travel < 90 min)
INSERT INTO public.office_locations (
  id, organization_id, name, address, latitude, longitude, radius_meters,
  is_active, is_client_location, client_id, estimated_travel_minutes
)
VALUES (
  'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'VA Verify Near Client',
  'Near client — Grogol',
  -6.167500, 106.790600, 150, true, true,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  25
)
ON CONFLICT (id) DO UPDATE SET
  estimated_travel_minutes = 25,
  is_client_location = true,
  is_active = true,
  updated_at = now();

-- Far client site (travel >= 90 min via override)
INSERT INTO public.office_locations (
  id, organization_id, name, address, latitude, longitude, radius_meters,
  is_active, is_client_location, client_id, estimated_travel_minutes
)
VALUES (
  'd4d4d4d4-4444-4444-8444-444444444402'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'VA Verify Far Client',
  'Far client — Bandung area coords',
  -6.914744, 107.609810, 200, true, true,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  120
)
ON CONFLICT (id) DO UPDATE SET
  estimated_travel_minutes = 120,
  is_client_location = true,
  is_active = true,
  updated_at = now();

DROP TABLE IF EXISTS _va_verify;
CREATE TEMP TABLE _va_verify (
  test_id text PRIMARY KEY,
  description text,
  expected text,
  actual text,
  pass boolean
);

-- Seed isolated visits for mode tests (delete first)
DELETE FROM public.client_visits
WHERE id IN (
  'f5f5f5f5-5555-4555-8555-555555555501'::uuid,
  'f5f5f5f5-5555-4555-8555-555555555502'::uuid,
  'f5f5f5f5-5555-4555-8555-555555555503'::uuid
);

INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time
)
VALUES (
  'f5f5f5f5-5555-4555-8555-555555555501'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
  '2026-06-15'::date,
  'VA verify office-first',
  'scheduled',
  '13:00'::time, '15:00'::time
);

-- V01 office-first: visit 13:00, travel < 90
INSERT INTO _va_verify
SELECT
  'V01_office_first_mode',
  'Office-first when visit afternoon and travel under threshold',
  'mode=office_first',
  m->>'mode',
  m->>'mode' = 'office_first'
FROM (
  SELECT public.resolve_visit_day_mode(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-15'::date
  ) AS m
) s;

-- V02 field-first: visit 08:00
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time
)
VALUES (
  'f5f5f5f5-5555-4555-8555-555555555502'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
  '2026-06-16'::date,
  'VA verify field-first',
  'scheduled',
  '08:00'::time, '10:00'::time
);

INSERT INTO _va_verify
SELECT
  'V02_field_first_mode',
  'Field-first when visit at work start',
  'mode=field_first',
  m->>'mode',
  m->>'mode' = 'field_first'
FROM (
  SELECT public.resolve_visit_day_mode(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-16'::date
  ) AS m
) s;

-- V03 travel_field: visit 13:00, travel >= 90
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time
)
VALUES (
  'f5f5f5f5-5555-4555-8555-555555555503'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'd4d4d4d4-4444-4444-8444-444444444402'::uuid,
  '2026-06-17'::date,
  'VA verify travel field',
  'scheduled',
  '13:00'::time, '16:00'::time
);

INSERT INTO _va_verify
SELECT
  'V03_travel_field_mode',
  'Travel field when afternoon visit and travel >= threshold',
  'mode=travel_field',
  m->>'mode',
  m->>'mode' = 'travel_field'
FROM (
  SELECT public.resolve_visit_day_mode(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-17'::date
  ) AS m
) s;

-- V04 spontaneous => field_first
INSERT INTO _va_verify
SELECT
  'V04_spontaneous_field_first',
  'Spontaneous visit resolves field_first',
  'mode=field_first',
  m->>'mode',
  m->>'mode' = 'field_first'
FROM (
  SELECT public.resolve_visit_day_mode(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-18'::date,
    'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
    true
  ) AS m
) s;

-- V05 office-first late vs work start (11:34 check-in => late)
INSERT INTO _va_verify
SELECT
  'V05_office_first_late_vs_work',
  'Office-first late reference is work start 08:00',
  'is_late=true',
  format('is_late=%s late_min=%s ref=%s', is_late, late_minutes, late_reference_time),
  is_late IS TRUE AND late_minutes > 0
FROM (
  SELECT
    (l->>'is_late')::boolean AS is_late,
    (l->>'late_minutes')::integer AS late_minutes,
    (l->>'late_reference_time')::time AS late_reference_time
  FROM (
    SELECT public.resolve_attendance_late_for_day(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-15'::date,
      '2026-06-15 11:34:00'::timestamp,
      'f5f5f5f5-5555-4555-8555-555555555501'::uuid,
      false
    ) AS l
  ) x
) y;

-- V06 penalty exemption blocks auto-apply
DO $$
DECLARE
  v_ar_id uuid := 'a6a6a6a6-6666-4666-8666-666666666601'::uuid;
  v_result jsonb;
BEGIN
  DELETE FROM public.attendance_penalties WHERE attendance_record_id = v_ar_id;
  DELETE FROM public.attendance_records WHERE id = v_ar_id;
  DELETE FROM public.penalty_exemptions
  WHERE id = 'a7a7a7a7-7777-4777-8777-777777777701'::uuid;

  INSERT INTO public.penalty_exemptions (
    id, organization_id, employee_id, exemption_type, start_date, end_date, is_active, reason
  )
  VALUES (
    'a7a7a7a7-7777-4777-8777-777777777701'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    'manual',
    '2026-06-20'::date,
    '2026-06-20'::date,
    true,
    'VA verify exemption'
  );

  INSERT INTO public.attendance_records (
    id, employee_id, organization_id, attendance_date,
    check_in_time, check_in_at, is_late, late_minutes, status
  )
  VALUES (
    v_ar_id,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-20'::date,
    '11:00'::time,
    ('2026-06-20 11:00:00+07')::timestamptz,
    true,
    180,
    'present'
  );

  v_result := public.apply_late_arrival_penalties(v_ar_id);

  INSERT INTO _va_verify VALUES (
    'V06_penalty_exemption',
    'Active exemption returns applied=0',
    'applied=0',
    format('applied=%s reason=%s', v_result->>'applied', v_result->>'reason'),
    COALESCE((v_result->>'applied')::integer, -1) = 0
  );
END $$;

-- V07 record_attendance_from_client_visit sets check_in_source=client_visit
DO $$
DECLARE
  v_visit_id uuid := 'f8f8f8f8-8888-4888-8888-888888888801'::uuid;
  v_result jsonb;
  v_source text;
BEGIN
  DELETE FROM public.attendance_records
  WHERE employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND attendance_date = '2026-06-16'::date;
  DELETE FROM public.client_visits WHERE id = v_visit_id;

  UPDATE public.office_locations
  SET radius_meters = 500, latitude = -6.167500, longitude = 106.790600
  WHERE id = 'd4d4d4d4-4444-4444-8444-444444444401'::uuid;

  INSERT INTO public.client_visits (
    id, organization_id, lead_client_id, employee_id, validated_location_id,
    visit_date, visit_purpose, status, planned_start_time, planned_end_time,
    actual_start_time, start_location, start_photo_path
  )
  VALUES (
    v_visit_id,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
    '2026-06-16'::date,
    'VA verify auto attendance',
    'ongoing',
    '08:00'::time, '10:00'::time,
    ('2026-06-16 08:05:00+07')::timestamptz,
    jsonb_build_object('latitude', -6.167500, 'longitude', 106.790600, 'address', 'client'),
    NULL
  );

  v_result := public.record_attendance_from_client_visit(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-16'::date,
    v_visit_id,
    'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
    ('2026-06-16 08:05:00+07')::timestamptz,
    jsonb_build_object('latitude', -6.167500, 'longitude', 106.790600, 'address', 'client'),
    NULL,
    'Asia/Jakarta',
    false,
    NULL
  );

  SELECT ar.check_in_source
  INTO v_source
  FROM public.attendance_records ar
  WHERE ar.id = (v_result->>'attendance_id')::uuid;

  INSERT INTO _va_verify VALUES (
    'V07_auto_checkin_source',
    'Start Visit auto attendance uses check_in_source=client_visit',
    'client_visit',
    COALESCE(v_source, 'NULL'),
    v_source = 'client_visit'
      AND COALESCE((v_result->>'attendance_auto_checkin')::boolean, false) IS TRUE
  );
END $$;

-- V08 estimate_travel_minutes respects HR override
INSERT INTO _va_verify
SELECT
  'V08_travel_override',
  'Far client HR override returns 120 minutes',
  '120',
  travel_mins::text,
  travel_mins = 120
FROM (
  SELECT public.estimate_travel_minutes(
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    'd4d4d4d4-4444-4444-8444-444444444402'::uuid
  ) AS travel_mins
) s;

SELECT '--- VERIFY MATRIX ---' AS section;
SELECT * FROM _va_verify ORDER BY test_id;

SELECT '--- SUMMARY ---' AS section;
SELECT
  count(*) FILTER (WHERE pass) AS passed,
  count(*) FILTER (WHERE NOT pass) AS failed,
  count(*) AS total
FROM _va_verify;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed FROM _va_verify WHERE NOT pass;
  IF v_failed > 0 THEN
    RAISE EXCEPTION 'visit-attendance-integration verify failed: % case(s)', v_failed;
  END IF;
END $$;
