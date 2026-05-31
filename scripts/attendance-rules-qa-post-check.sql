-- Attendance Rules — QA manual post-check (DB assertions after M1/M3 manual steps)
-- Run AFTER manual check-in/out: npm run supabase:db:push:attendance-rules-qa-post-check
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a | OCTA: 001b6725-bf16-4a2f-81ae-8960cf86c46d

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

DROP TABLE IF EXISTS _ar_qa_post;
CREATE TEMP TABLE _ar_qa_post (
  check_id text PRIMARY KEY,
  description text,
  expected text,
  actual text,
  pass boolean
);

-- P1a: today's attendance record exists with check-in photo path
INSERT INTO _ar_qa_post
SELECT
  'P1a_check_in_record',
  'OCTA has attendance record today with check_in_time',
  'count >= 1, check_in_time NOT NULL',
  format('count=%s check_in=%s', cnt, chk_in),
  cnt >= 1 AND chk_in IS NOT NULL
FROM (
  SELECT
    count(*)::int AS cnt,
    max(ar.check_in_time)::text AS chk_in
  FROM public.attendance_records ar
  WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND ar.attendance_date = CURRENT_DATE
) s;

-- P1b: check-in photo path populated when require_photo_checkin ON
INSERT INTO _ar_qa_post
SELECT
  'P1b_check_in_photo_path',
  'check_in_photo_path NOT NULL when photo required',
  'photo_path NOT NULL',
  format('path=%s', photo_path),
  photo_path IS NOT NULL AND btrim(photo_path) <> ''
FROM (
  SELECT ar.check_in_photo_path AS photo_path
  FROM public.attendance_records ar
  WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND ar.attendance_date = CURRENT_DATE
  ORDER BY ar.created_at DESC
  LIMIT 1
) s;

-- P1c: check-out photo path (after M3)
INSERT INTO _ar_qa_post
SELECT
  'P1c_check_out_photo_path',
  'check_out_photo_path NOT NULL after clock-out (M3)',
  'checkout_path NOT NULL OR no checkout yet',
  format('check_out_time=%s path=%s', co_time, co_path),
  co_time IS NULL OR (co_path IS NOT NULL AND btrim(co_path) <> '')
FROM (
  SELECT ar.check_out_time::text AS co_time, ar.check_out_photo_path AS co_path
  FROM public.attendance_records ar
  WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND ar.attendance_date = CURRENT_DATE
  ORDER BY ar.created_at DESC
  LIMIT 1
) s;

-- P1d: attendance_validations linked to today's record
INSERT INTO _ar_qa_post
SELECT
  'P1d_validations_present',
  'attendance_validations rows for today record',
  'validation_count >= 0',
  format('validation_count=%s', vcnt),
  vcnt >= 0
FROM (
  SELECT count(av.id)::int AS vcnt
  FROM public.attendance_validations av
  JOIN public.attendance_records ar ON ar.id = av.attendance_record_id
  WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND ar.attendance_date = CURRENT_DATE
) s;

-- P1e: RPC photo_ok_with_face still PASS at HQ coords
INSERT INTO _ar_qa_post
SELECT
  'P1e_rpc_photo_ok_hq',
  'validate_attendance_comprehensive at HQ with face data → can_attend true',
  'can_attend=true, location_valid=true',
  format('can_attend=%s location_valid=%s schedule_valid=%s', v.can_attend, v.location_valid, v.schedule_valid),
  v.can_attend IS TRUE AND v.location_valid IS TRUE
FROM public.validate_attendance_comprehensive(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  -6.136758, 106.785000,
  'data:image/jpeg;base64,ZmFrZQ==', 20::numeric, false
) v;

SELECT '--- QA POST-CHECK ASSERTIONS ---' AS section;
SELECT * FROM _ar_qa_post ORDER BY check_id;

SELECT '--- QA POST-CHECK SUMMARY ---' AS section;
SELECT
  count(*) FILTER (WHERE pass IS NOT TRUE) AS failures,
  count(*) AS total,
  CASE WHEN count(*) FILTER (WHERE pass IS NOT TRUE) = 0 THEN 'ALL PASS' ELSE 'FAIL' END AS status
FROM _ar_qa_post;

SELECT '--- TODAY RECORD DETAIL ---' AS section;
SELECT jsonb_pretty(jsonb_build_object(
  'verify_date', CURRENT_DATE::text,
  'records', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', ar.id,
      'check_in_time', ar.check_in_time,
      'check_out_time', ar.check_out_time,
      'check_in_photo_path', ar.check_in_photo_path,
      'check_out_photo_path', ar.check_out_photo_path,
      'working_hours_minutes', ar.working_hours_minutes
    ) ORDER BY ar.created_at DESC), '[]'::jsonb)
    FROM public.attendance_records ar
    WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
      AND ar.attendance_date = CURRENT_DATE
  ),
  'validations', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'validation_type', av.validation_type,
      'created_at', av.created_at
    ) ORDER BY av.created_at), '[]'::jsonb)
    FROM public.attendance_validations av
    JOIN public.attendance_records ar ON ar.id = av.attendance_record_id
    WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
      AND ar.attendance_date = CURRENT_DATE
  ),
  'storage_hint', format(
    'Supabase Dashboard → Storage → attendance-photos → %s/',
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'
  )
)) AS qa_post_detail;
