-- QA: shift recap email dispatch after pos_end_shift
-- Run in Supabase SQL Editor with a real org/outlet and open shift.

-- 1) Confirm org toggle column exists
-- SELECT shift_recap_email_enabled
-- FROM public.operational_email_notification_settings
-- WHERE organization_id = 'YOUR_ORG_ID'::uuid;

-- 2) Close shift (as authenticated cashier via client or impersonation)
-- SELECT public.pos_end_shift('YOUR_OPEN_SHIFT_ID'::uuid, 150000::numeric);

-- 3) Dispatch row should exist (pending_send when enabled)
-- SELECT id, shift_id, status, language, recipient_count, created_at
-- FROM public.pos_shift_email_dispatches
-- WHERE shift_id = 'YOUR_OPEN_SHIFT_ID'::uuid;

-- 4) Idempotent enqueue — second call must not duplicate row
-- SELECT public.enqueue_pos_shift_recap_email('YOUR_OPEN_SHIFT_ID'::uuid, 'en');
-- SELECT count(*) FROM public.pos_shift_email_dispatches WHERE shift_id = 'YOUR_OPEN_SHIFT_ID'::uuid;
-- Expected: count = 1

-- 5) Toggle off → skipped_disabled on next enqueue (new shift only; existing row unchanged)
-- UPDATE public.operational_email_notification_settings
-- SET shift_recap_email_enabled = false
-- WHERE organization_id = 'YOUR_ORG_ID'::uuid;
-- -- Open + close another shift, then:
-- SELECT status FROM public.pos_shift_email_dispatches
-- WHERE shift_id = 'ANOTHER_SHIFT_ID'::uuid;
-- Expected: skipped_disabled

-- 6) Re-enable and verify upsert RPC accepts new param
-- SELECT public.upsert_operational_email_notification_settings(
--   'YOUR_ORG_ID'::uuid,
--   true, true, true, true, true
-- );

-- 7) Detail payload for edge function (closed_by_user_id for recipients)
-- SELECT public.pos_shift_detail('YOUR_OPEN_SHIFT_ID'::uuid)
--   -> 'closed_by_user_id', 'cash_difference', 'payment_methods';

-- 8) After edge invoke (dispatch-pos-shift-recap), status should be sent or send_failed
-- SELECT status, recipient_count, resend_message_id, error_message, sent_at
-- FROM public.pos_shift_email_dispatches
-- WHERE shift_id = 'YOUR_OPEN_SHIFT_ID'::uuid;
