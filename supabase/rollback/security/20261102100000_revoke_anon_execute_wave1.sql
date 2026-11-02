-- Rollback 20261102100000_revoke_anon_execute_wave1.sql
-- Mengembalikan EXECUTE yang dicabut gelombang 1.
-- service_role tidak dicabut di sini: grant itu sudah ada sebelum gelombang ini.

-- Fungsi yang migration lamanya sudah REVOKE FROM PUBLIC.
-- PUBLIC tidak dikembalikan. anon dan authenticated dikembalikan.
GRANT EXECUTE ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_va_settlement(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_brick_va_settlement(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_attendance_auto_checkout(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_checkout_income(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_arrival_penalties(uuid) TO anon, authenticated;

-- Fungsi yang tidak pernah REVOKE FROM PUBLIC di migration lama.
GRANT EXECUTE ON FUNCTION public.claim_daily_task_assignment_push_queue(uuid, integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_task_completion_push_queue(uuid, integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_posts(integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_contacts_sync_jobs(integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_resume_publishing_posts(integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_media_production_push_queue(uuid, integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_task_step_comment_push_queue(uuid, integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_income_bank_deposit(uuid, uuid, uuid, numeric, uuid, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._purge_organization_rows(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_social_media_load_test_rows() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_plan_modules(uuid, jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._regenerate_plan_features_for_plan(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_performance_bonus(uuid) TO PUBLIC, anon, authenticated;
