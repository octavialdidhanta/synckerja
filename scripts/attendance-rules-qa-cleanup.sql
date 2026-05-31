-- Attendance Rules — QA manual cleanup (restore demo state)
-- Run AFTER QA session: npm run supabase:db:push:attendance-rules-qa-cleanup
--
-- Partial cleanup (after W3 only, before M1): run C1 block only — see docs/attendance-rules-qa-signoff.md

-- ===========================================================================
-- C1) Remove QA holiday
-- ===========================================================================
DELETE FROM public.national_holidays nh
WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND nh.name = 'QA Manual Holiday Today';

-- ===========================================================================
-- C2) Remove QA allowed IP
-- ===========================================================================
DELETE FROM public.allowed_ip_addresses a
WHERE a.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND a.name = 'QA WiFi Fallback';

-- ===========================================================================
-- C3) Restore face registrations from backup
-- ===========================================================================
DO $$
DECLARE
  v_backup_count int;
BEGIN
  SELECT count(*)::int INTO v_backup_count
  FROM public._attendance_rules_qa_face_backup;

  IF v_backup_count > 0 THEN
    DELETE FROM public.employee_face_registrations efr
    WHERE efr.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
      AND efr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

    INSERT INTO public.employee_face_registrations
    SELECT * FROM public._attendance_rules_qa_face_backup;

    TRUNCATE public._attendance_rules_qa_face_backup;
  END IF;
END $$;

-- ===========================================================================
-- C4) Optional reset — OCTA attendance today (for next QA run)
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
-- C5) Restore settings defaults
-- ===========================================================================
UPDATE public.attendance_rules_settings
SET
  enforce_national_holidays = true,
  require_photo_checkin = true,
  require_photo_checkout = true,
  require_gps_accuracy = false,
  gps_accuracy_threshold_meters = 50,
  default_max_radius_meters = 100,
  updated_at = now()
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

SELECT '--- QA CLEANUP COMPLETE ---' AS section;

SELECT jsonb_pretty(jsonb_build_object(
  'verify_date', CURRENT_DATE::text,
  'holiday_qa_remaining', (
    SELECT count(*)::int FROM public.national_holidays nh
    WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND nh.name = 'QA Manual Holiday Today'
  ),
  'qa_ip_remaining', (
    SELECT count(*)::int FROM public.allowed_ip_addresses a
    WHERE a.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND a.name = 'QA WiFi Fallback'
  ),
  'face_reg_count_octa', (
    SELECT count(*)::int FROM public.employee_face_registrations efr
    WHERE efr.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  ),
  'face_backup_remaining', (
    SELECT count(*)::int FROM public._attendance_rules_qa_face_backup
  ),
  'attendance_records_today_octa', (
    SELECT count(*)::int FROM public.attendance_records ar
    WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
      AND ar.attendance_date = CURRENT_DATE
  ),
  'settings', (
    SELECT jsonb_build_object(
      'enforce_national_holidays', ars.enforce_national_holidays,
      'require_photo_checkin', ars.require_photo_checkin,
      'require_photo_checkout', ars.require_photo_checkout
    )
    FROM public.attendance_rules_settings ars
    WHERE ars.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  )
)) AS qa_cleanup_report;
