DO $$
DECLARE v_user uuid;
BEGIN
  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid;
  IF v_user IS NOT NULL THEN PERFORM set_config('request.jwt.claim.sub', v_user::text, true); END IF;
END $$;

SELECT jsonb_pretty(jsonb_build_object(
  'verify_date', CURRENT_DATE::text,
  'settings', (
    SELECT jsonb_build_object(
      'enforce_national_holidays', ars.enforce_national_holidays,
      'require_photo_checkin', ars.require_photo_checkin,
      'require_photo_checkout', ars.require_photo_checkout
    )
    FROM public.attendance_rules_settings ars
    WHERE ars.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  ),
  'photo_block_no_face', (
    SELECT jsonb_build_object('can_attend', v.can_attend, 'photo_required', v.photo_required, 'location_valid', v.location_valid)
    FROM public.validate_attendance_comprehensive(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid, '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      -6.136758, 106.785000, NULL, 20, false
    ) v
  ),
  'photo_ok_with_face', (
    SELECT jsonb_build_object('can_attend', v.can_attend, 'photo_required', v.photo_required, 'schedule_valid', v.schedule_valid)
    FROM public.validate_attendance_comprehensive(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid, '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      -6.136758, 106.785000, 'data:image/jpeg;base64,ZmFrZQ==', 20, false
    ) v
  ),
  'outside_radius', (
    SELECT jsonb_build_object('can_attend', v.can_attend, 'location_valid', v.location_valid, 'distance_meters', round(v.distance_meters::numeric,1))
    FROM public.validate_attendance_comprehensive(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid, '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      -6.20, 106.90, 'data:image/jpeg;base64,ZmFrZQ==', 20, false
    ) v
  ),
  'checkout_no_photo', (
    SELECT jsonb_build_object('can_checkout', c.can_checkout, 'photo_required', c.photo_required)
    FROM public.validate_checkout_comprehensive(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid, '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid, NULL, NULL
    ) c
  ),
  'resolver_saturday_2026_06_21', (
    SELECT jsonb_build_object('source', r.source, 'is_working_day', r.is_working_day, 'shift_id', r.shift_id)
    FROM public.resolve_effective_schedule(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid, '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid, '2026-06-21'::date
    ) r
  )
)) AS spot_check_report;
