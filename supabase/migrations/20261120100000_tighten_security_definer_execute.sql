-- Tighten EXECUTE on SECURITY DEFINER functions (Security Advisor lints 0028 / 0029).
--
-- 1) Trigger functions: SECURITY DEFINER functions that return `trigger` are only ever fired
--    by Postgres itself. EXECUTE is not checked when a trigger fires, so revoking it from
--    PUBLIC/anon/authenticated has no runtime effect; it only removes them from the API.
--
-- 2) Login-only / server-only functions: revoke anon (and PUBLIC). Every function below already
--    rejects anonymous callers internally; this is a second layer so a future edit that forgets
--    the internal check does not become reachable without login. Callers were checked:
--    frontend callers sit behind RequireAuth; edge-function callers use the service role.
--    authenticated + service_role keep EXECUTE (granted explicitly, since some functions only
--    had it through PUBLIC). Three functions are server-only and lose authenticated too.
--
--    NOT touched on purpose:
--      * public flows (online order, review links, customer survey, recruitment tests,
--        analytics tracking, signup/verification, short links, job/recruitment counters);
--      * functions used inside RLS / storage policies (auth_profile_id, is_cms_admin,
--        user_is_org_owner_or_admin, is_omnichannel_survey_settings_admin,
--        candidate_profile_accessible, task_step_comment_can_access/can_write,
--        task_files_storage_can_write, lead_magnet_assets_storage_can_write,
--        synckerja_order_receipt_logo_is_public) and lead_status_is_resolved_or_expired_visibility.
--
-- 3) Default privileges: already in place (verified 2026-11-20). Functions created by `postgres`
--    in schema public get EXECUTE for authenticated + service_role only, not anon/PUBLIC.
--    A new public RPC therefore needs an explicit `GRANT EXECUTE ... TO anon` in its migration.
--
-- Current ACLs are snapshotted to ops_backup.function_acl_20261120 for the rollback script.

SET LOCAL search_path = public, extensions, pg_temp;

CREATE SCHEMA IF NOT EXISTS ops_backup;
REVOKE ALL ON SCHEMA ops_backup FROM PUBLIC, anon, authenticated;

CREATE TABLE ops_backup.function_acl_20261120 AS
SELECT p.oid::regprocedure::text AS func, p.proacl::text AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef;
REVOKE ALL ON ops_backup.function_acl_20261120 FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
  v_trig int := 0;
  v_login int := 0;
  v_server int := 0;
  v_login_only text[] := ARRAY[
    'admin_get_organization_sales_modules','admin_get_plan_modules','admin_list_lead_submissions',
    'admin_list_organization_module_adjustments','admin_list_organizations','admin_list_plan_add_on_overrides',
    'admin_list_plan_module_adjustments','admin_list_plan_price_adjustments','admin_list_subscription_add_ons',
    'admin_list_subscription_plans','admin_organizations_summary','admin_preview_organization_deletion',
    'admin_verify_organization_deleted',
    'apply_catalog_checkout_stock','apply_catalog_fulfillment_stock','record_store_checkout_income',
    'reverse_store_checkout_stock',
    'crm_customer_survey_summary','get_active_payroll_paid_announcements','get_catalog_inventory_workflow_modes',
    'get_click_targets_for_utm_row','get_traffic_sessions_by_utm_campaign',
    'get_email_conversations_with_preview','get_facebook_conversations_with_preview',
    'get_instagram_conversations_with_preview','get_threads_conversations_with_preview',
    'get_whatsapp_conversations_with_preview',
    'get_organization_members','get_pos_receipt_send_status','is_plan_pic',
    'list_catalog_inventory_org_roles','list_pos_receipt_feedback','log_payroll_bank_export',
    'pos_staff_is_user_verified','pos_staff_verify_pin','pos_verify_admin_pin_for_outlet',
    'task_step_comment_unread_count',
    'validate_attendance_comprehensive','validate_checkout_comprehensive','validate_client_visit_location',
    'compute_lead_magnet_addon_amount'];
  v_server_only text[] := ARRAY[
    'maybe_refresh_analytics_rollups','get_latest_signup_verification_token','issue_new_verification_token'];
BEGIN
  -- 1) trigger functions
  FOR r IN
    SELECT p.oid::regprocedure AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.f);
    v_trig := v_trig + 1;
  END LOOP;

  -- 2a) login-only
  FOR r IN
    SELECT p.oid::regprocedure AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname = ANY (v_login_only)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.f);
    v_login := v_login + 1;
  END LOOP;

  -- 2b) server-only (called by edge functions with the service role)
  FOR r IN
    SELECT p.oid::regprocedure AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname = ANY (v_server_only)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.f);
    v_server := v_server + 1;
  END LOOP;

  IF v_login < array_length(v_login_only, 1) OR v_server < array_length(v_server_only, 1) THEN
    RAISE EXCEPTION 'missing functions: login % of %, server % of %',
      v_login, array_length(v_login_only, 1), v_server, array_length(v_server_only, 1);
  END IF;
  RAISE NOTICE 'trigger=% login_only=% server_only=%', v_trig, v_login, v_server;
END $$;
