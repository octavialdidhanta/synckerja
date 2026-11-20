-- Security Advisor: "Public Can Execute SECURITY DEFINER Function"
--
-- 1) Loop: REVOKE EXECUTE from PUBLIC + anon on every public SECURITY DEFINER function; GRANT authenticated + service_role.
-- 2) Allowlist: GRANT EXECUTE TO anon again for RPCs that MUST run before login (see src/0-register, PublicContentReviewPage,
--    job boards, candidate_profile_accessible for RLS, analytics_session_touch, etc.).
--
-- IMPORTANT — Advisor can still show ~100+ warnings for allowlisted functions:
-- Supabase flags *any* SECURITY DEFINER callable with the anon key as "public / without signing in".
-- That is *intentional* here: e.g. `email_exists` runs *before* signUp (no JWT yet); email/token RPCs read rows that have
-- no anon RLS by design; public review + job counters are guest-facing. Clearing these warnings *without* changing product
-- behaviour requires moving those flows to Edge Functions (service role) or another backend — not only SQL grants.
--
-- Do NOT remove the second block without replacing those call paths, or registration / guest pages will break.

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
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END;
$$;

-- Anonymous / pre-session RPCs (keep aligned with src/0-register, PublicContentReviewPage, job boards, RLS helpers).
DO $$
DECLARE
  fn text;
  allowlist text[] := ARRAY[
    'public.email_exists(text)',
    'public.confirm_email_verification(text)',
    'public.confirm_email_verification_otp(text, text)',
    'public.ensure_registration_profile(uuid, text)',
    'public.get_latest_signup_verification_token(uuid, text)',
    'public.get_verification_token_snapshot(text)',
    'public.issue_new_verification_token(text)',
    'public.poll_email_verified_by_token(text, uuid)',
    'public.registration_has_verified_email(uuid, text)',
    'public.registration_verify_email_page_allowed(uuid, text)',
    'public.get_public_review_content_by_token(text)',
    'public.get_public_review_comments(text)',
    'public.get_public_review_brief_extended_by_token(text)',
    'public.insert_public_review_comment(text, text, text, numeric, jsonb)',
    'public.update_public_review_comment(uuid, text, text, text)',
    'public.delete_public_review_comment(uuid, text, text)',
    'public.increment_job_clicks(uuid)',
    'public.increment_job_submissions(uuid)',
    'public.increment_recruitment_link_clicks(uuid)',
    'public.increment_recruitment_link_submissions(uuid)',
    'public.increment_marketing_short_link_click(uuid)',
    'public.record_marketing_short_link_visitor(uuid, text)',
    'public.candidate_profile_accessible(uuid)',
    'public.analytics_session_touch(uuid, text, text, text, uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY allowlist
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', fn);
    EXCEPTION
      WHEN undefined_function THEN
        NULL;
    END;
  END LOOP;
END;
$$;
