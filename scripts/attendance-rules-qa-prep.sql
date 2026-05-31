-- Attendance Rules — QA manual prep (linked demo org)
-- Run BEFORE manual QA session: npm run supabase:db:push:attendance-rules-qa-prep
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a | OCTA: 001b6725-bf16-4a2f-81ae-8960cf86c46d
--
-- W2: Replace YOUR_PUBLIC_IP with tester public IP (https://ipapi.co/json) before running.

-- ===========================================================================
-- P1) JWT impersonation (OCTA)
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
-- P2) Seed minimal rules + office AR Fresh Demo HQ
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
-- P3) Clean slate — OCTA attendance today
-- ===========================================================================
DELETE FROM public.attendance_validations av
WHERE av.attendance_record_id IN (
  SELECT ar.id FROM public.attendance_records ar
  WHERE ar.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND ar.attendance_date = CURRENT_DATE
);

DELETE FROM public.attendance_records ar
WHERE ar.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  AND ar.attendance_date = CURRENT_DATE;

-- ===========================================================================
-- P4) W3 prep — national holiday TODAY + enforce ON
-- ===========================================================================
DELETE FROM public.national_holidays nh
WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND nh.name = 'QA Manual Holiday Today';

INSERT INTO public.national_holidays (
  organization_id, name, date, is_active, applies_to_attendance, country_code
)
VALUES (
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'QA Manual Holiday Today',
  CURRENT_DATE,
  true, true, 'ID'
);

UPDATE public.attendance_rules_settings
SET enforce_national_holidays = true
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- ===========================================================================
-- P5) W2 prep — allowed IP (edit YOUR_PUBLIC_IP before run)
-- ===========================================================================
DELETE FROM public.allowed_ip_addresses a
WHERE a.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND a.name = 'QA WiFi Fallback';

INSERT INTO public.allowed_ip_addresses (
  id, organization_id, cidr, ip_address, name, description, is_active
)
VALUES (
  'a5a5a5a5-5555-4555-8555-555555555501'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'YOUR_PUBLIC_IP/32',
  'YOUR_PUBLIC_IP/32',
  'QA WiFi Fallback',
  'Manual QA W2 — replace YOUR_PUBLIC_IP with tester public IPv4',
  true
);

-- ===========================================================================
-- P6) W4 prep — backup face registrations, then remove active rows
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public._attendance_rules_qa_face_backup (
  LIKE public.employee_face_registrations INCLUDING ALL
);

TRUNCATE public._attendance_rules_qa_face_backup;

INSERT INTO public._attendance_rules_qa_face_backup
SELECT *
FROM public.employee_face_registrations efr
WHERE efr.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  AND efr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

DELETE FROM public.employee_face_registrations efr
WHERE efr.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  AND efr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- ===========================================================================
-- P7) Preflight context
-- ===========================================================================
SELECT '--- QA PREP PREFLIGHT ---' AS section;

SELECT jsonb_pretty(jsonb_build_object(
  'verify_date', CURRENT_DATE::text,
  'jwt_sub', current_setting('request.jwt.claim.sub', true),
  'office_active', (
    SELECT jsonb_agg(jsonb_build_object(
      'id', ol.id, 'name', ol.name,
      'lat', ol.latitude, 'lng', ol.longitude, 'radius_m', ol.radius_meters
    ))
    FROM public.office_locations ol
    WHERE ol.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND ol.is_active IS TRUE
      AND ol.name = 'AR Fresh Demo HQ'
  ),
  'settings', (
    SELECT jsonb_build_object(
      'enforce_national_holidays', ars.enforce_national_holidays,
      'require_photo_checkin', ars.require_photo_checkin,
      'require_photo_checkout', ars.require_photo_checkout,
      'require_gps_accuracy', ars.require_gps_accuracy
    )
    FROM public.attendance_rules_settings ars
    WHERE ars.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  ),
  'face_reg_count_octa', (
    SELECT count(*)::int FROM public.employee_face_registrations efr
    WHERE efr.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  ),
  'face_backup_count', (
    SELECT count(*)::int FROM public._attendance_rules_qa_face_backup
  ),
  'holiday_today', (
    SELECT jsonb_agg(jsonb_build_object('name', nh.name, 'date', nh.date::text))
    FROM public.national_holidays nh
    WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND nh.date = CURRENT_DATE
      AND nh.is_active IS TRUE
  ),
  'allowed_ips_qa', (
    SELECT jsonb_agg(jsonb_build_object('name', a.name, 'ip_address', a.ip_address, 'is_active', a.is_active))
    FROM public.allowed_ip_addresses a
    WHERE a.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND a.name = 'QA WiFi Fallback'
  ),
  'attendance_records_today_octa', (
    SELECT count(*)::int FROM public.attendance_records ar
    WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
      AND ar.attendance_date = CURRENT_DATE
  ),
  'w3_rpc_holiday_block', (
    SELECT jsonb_build_object(
      'is_holiday', v.is_holiday,
      'can_attend', v.can_attend,
      'expected', 'is_holiday=true, can_attend=false'
    )
    FROM public.validate_attendance_comprehensive(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      -6.136758, 106.785000,
      'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
    ) v
  ),
  'w4_no_face_reg', (
    SELECT jsonb_build_object(
      'face_registered', v.face_registered,
      'can_attend', v.can_attend
    )
    FROM public.validate_attendance_comprehensive(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      -6.136758, 106.785000,
      'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
    ) v
  )
)) AS qa_prep_preflight;
