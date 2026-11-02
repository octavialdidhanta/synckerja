-- Gelombang 1: tutup EXECUTE anon pada fungsi SECURITY DEFINER yang tidak dipanggil browser.
-- Isi fungsi tidak diubah.
-- REVOKE FROM PUBLIC tidak menghapus grant default Supabase ke anon dan authenticated.
-- Fungsi yang dipanggil halaman login, review publik, kasir order, atau aplikasi
-- yang sudah login tidak masuk file ini.

-- Dipanggil edge function dengan service role.
REVOKE EXECUTE ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_xendit_va_settlement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_va_settlement(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_brick_va_settlement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_brick_va_settlement(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_attendance_auto_checkout(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_attendance_auto_checkout(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_daily_task_assignment_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_task_assignment_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_daily_task_completion_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_task_completion_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_due_scheduled_posts(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_posts(integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_google_contacts_sync_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_contacts_sync_jobs(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_resume_publishing_posts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_resume_publishing_posts(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_social_media_production_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_media_production_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_task_step_comment_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_task_step_comment_push_queue(uuid, integer, integer) TO service_role;

-- Hanya dipanggil fungsi SECURITY DEFINER lain, trigger, pg_cron sebagai superuser, atau skrip postgres.
-- Tidak di-GRANT ke service_role.
REVOKE EXECUTE ON FUNCTION public.credit_income_bank_deposit(uuid, uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_store_checkout_income(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._purge_organization_rows(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_social_media_load_test_rows() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._apply_plan_modules(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._regenerate_plan_features_for_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_performance_bonus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_late_arrival_penalties(uuid) FROM PUBLIC, anon, authenticated;
