-- Security Advisor lint 0029: "Signed-In Users Can Execute SECURITY DEFINER Function"
--
-- Revoke EXECUTE from `authenticated` on public SECURITY DEFINER functions that are *not* meant to be
-- called directly via PostgREST by logged-in users (cron, Edge service_role-only RPCs, triggers, etc.).
--
-- Safe pattern: deny-by-exception — keep EXECUTE for `authenticated` only where the repo (web/mobile)
-- calls `supabase.rpc(...)`, plus small helpers required for nested RPC / RLS (see array below).
--
-- Must run after `20260513220000_security_definer_revoke_public_anon.sql` (which establishes baseline grants).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND NOT (
        p.proname = ANY (
          ARRAY[
            -- Nested helpers / RLS-adjacent DEFINER (session still needs EXECUTE when outer RPC invokes them)
            '_task_step_history_org_id',
            'candidate_profile_accessible',
            'user_organization_ids',
            'user_roles_actor_can_manage_org',
            -- Called from src/, android-mobile/, or guest/registration flows (authenticated session)
            'accept_ownership_transfer',
            'admin_blog_post_page_view_totals',
            'analytics_session_touch',
            'api_current_user_is_active_org_owner',
            'calculate_employee_leave_balance',
            'calculate_payroll_run_totals',
            'can_add_employee',
            'cleanup_user_organization_data',
            'cognitive_start_test',
            'cognitive_submit_answer',
            'cognitive_submit_test',
            'compute_omnichannel_seat_topup_amount',
            'confirm_email_verification',
            'confirm_email_verification_otp',
            'create_bank_transfer',
            'delete_bank_transfer_by_income_transaction',
            'disc_start_test',
            'disc_submit_answer',
            'disc_submit_test',
            'email_exists',
            'ensure_registration_profile',
            'get_all_resolved_blockers',
            'get_blocker_resolutions',
            'get_blockers_for_department_objective',
            'get_blockers_for_period',
            'get_blocker_count_for_department_objective',
            'get_blocker_count_for_period',
            'get_click_targets_for_path',
            'get_click_targets_for_source_key',
            'get_click_targets_for_utm_row',
            'get_department_objectives_with_key_results',
            'get_email_conversations_with_preview',
            'get_email_unread_counts',
            'get_employee_task_ids',
            'get_instagram_conversations_with_preview',
            'get_job_by_recruitment_token',
            'get_latest_signup_verification_token',
            'get_organization_members',
            'get_public_review_brief_extended_by_token',
            'get_public_review_comments',
            'get_public_review_content_by_token',
            'get_step_history_count',
            'get_subscription_status',
            'get_traffic_dashboard',
            'get_traffic_ingestion_status',
            'get_user_role_in_active_org',
            'get_verification_token_snapshot',
            'get_whatsapp_conversation_ids_by_message_search',
            'get_whatsapp_conversations_with_preview',
            'get_whatsapp_cycle_metrics',
            'get_whatsapp_unread_counts',
            'increment_job_clicks',
            'increment_job_submissions',
            'increment_marketing_short_link_click',
            'increment_recruitment_link_clicks',
            'increment_recruitment_link_submissions',
            'insert_public_review_comment',
            'issue_new_verification_token',
            'list_accessible_web_ids',
            'mark_email_conversation_read',
            'mark_plan_status_change_notifications_read',
            'mark_review_comment_notifications_read',
            'mark_whatsapp_conversation_read',
            'poll_email_verified_by_token',
            'process_payroll_run',
            'recalculate_pinjaman_online_debt_amount',
            'record_marketing_short_link_visitor',
            'record_attendance_with_timezone',
            'registration_has_verified_email',
            'registration_verify_email_page_allowed',
            'revert_completion_on_drive_link_removal',
            'search_whatsapp_messages',
            'sjt_start_test',
            'sjt_submit_answer',
            'sjt_submit_test',
            'transfer_ownership',
            'update_public_review_comment',
            'delete_public_review_comment',
            'validate_attendance_comprehensive',
            'validate_client_visit_location',
            'get_unresolved_blocker_counts'
          ]::text[]
        )
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
  END LOOP;
END;
$$;
