-- Iris fungsi kuning, 4 November 2026.
-- Versi 20261104130000 (kuning_critical_fixes) tercatat di production dengan
-- statement kosong. Tidak ada fungsi baru sesudah absensi selain
-- profiles_enforce_active_org_membership, jadi isi 130000 tidak dipulihkan.
-- Rollback: supabase/rollback/20261104_kuning_unguarded_fixes_rollback.sql
--
-- Pola pembungkus sama dengan wave 2: badan asli menjadi __impl,
-- pembungkus menolak authenticated/anon di luar organisasinya.

-- ---------------------------------------------------------------------------
-- A. Status koneksi platform. Klien yang ada memakai user login.
--    anon masih bisa memanggil badan yang hidup.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.is_blibli_seller_chat_connected(uuid)
  RENAME TO is_blibli_seller_chat_connected__impl;
ALTER FUNCTION public.is_linkedin_content_connected(uuid)
  RENAME TO is_linkedin_content_connected__impl;
ALTER FUNCTION public.is_tiktok_ads_connected(uuid)
  RENAME TO is_tiktok_ads_connected__impl;
ALTER FUNCTION public.is_tiktok_ads_integration_enabled(uuid)
  RENAME TO is_tiktok_ads_integration_enabled__impl;
ALTER FUNCTION public.is_tiktok_content_connected(uuid)
  RENAME TO is_tiktok_content_connected__impl;
ALTER FUNCTION public.is_youtube_content_connected(uuid)
  RENAME TO is_youtube_content_connected__impl;

CREATE OR REPLACE FUNCTION public.is_blibli_seller_chat_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_blibli_seller_chat_connected__impl(p_organization_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_linkedin_content_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_linkedin_content_connected__impl(p_organization_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_tiktok_ads_connected__impl(p_organization_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_integration_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_tiktok_ads_integration_enabled__impl(p_organization_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_content_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_tiktok_content_connected__impl(p_organization_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_youtube_content_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_youtube_content_connected__impl(p_organization_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.is_blibli_seller_chat_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blibli_seller_chat_connected__impl(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_blibli_seller_chat_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blibli_seller_chat_connected(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_linkedin_content_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_linkedin_content_connected__impl(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_linkedin_content_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_linkedin_content_connected(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tiktok_ads_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_connected__impl(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_tiktok_ads_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_connected(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tiktok_ads_integration_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_integration_enabled__impl(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_tiktok_ads_integration_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_integration_enabled(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tiktok_content_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_content_connected__impl(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_tiktok_content_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_content_connected(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_youtube_content_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_youtube_content_connected__impl(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_youtube_content_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_youtube_content_connected(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Fungsi kerja tanpa pemanggil klien. Edge function dan cron memakai
--    service_role atau postgres. authenticated tidak lagi bisa menjalankannya.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_meta_session_expired_conversations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_meta_session_expired_conversations() TO service_role;

REVOKE ALL ON FUNCTION public.apply_template_followup_customer_reply(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_template_followup_customer_reply(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_template_followup_sent(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_template_followup_sent(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.process_due_flow_delay_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_flow_delay_jobs(integer) TO service_role;

REVOKE ALL ON FUNCTION public.purge_expired_google_ads_metrics_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_google_ads_metrics_cache() TO service_role;

REVOKE ALL ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- C. Token daftar. Tanpa sesi, alur daftar tetap. Sesi yang ada hanya boleh
--    membaca atau membuat token untuk user yang sama.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_latest_signup_verification_token(p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_token text;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE u.id = p_user_id AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_matching_user');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_uid THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT t.token INTO v_token
  FROM public.email_verification_tokens t
  WHERE t.user_id = v_uid
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_token');
  END IF;

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.issue_new_verification_token(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_token text;
  v_expires timestamptz := now() + interval '24 hours';
  v_email_norm text := lower(trim(p_email));
BEGIN
  IF v_email_norm IS NULL OR length(v_email_norm) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(trim(email)) = v_email_norm
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_uid THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_token := public.generate_unique_verification_otp();
  INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified)
  VALUES (v_uid, v_token, v_expires, false);

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_registration_profile(p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT u.id, u.email INTO v_id, v_email
  FROM auth.users u
  WHERE u.id = p_user_id AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_matching_user');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_id THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO public.profiles (user_id, email)
  VALUES (v_id, COALESCE(v_email, ''))
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN json_build_object('ok', true);
END;
$function$;

-- ---------------------------------------------------------------------------
-- D. Daftar id organisasi order. Policy storage tetap memakai fungsi ini,
--    tetapi schema ops_private tidak diekspos PostgREST.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops_private.synckerja_order_activated_org_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id::text
  FROM public.synckerja_order_org_settings s
  WHERE s.terms_accepted_at IS NOT NULL;
$$;

COMMENT ON FUNCTION ops_private.synckerja_order_activated_org_ids() IS
  'Id organisasi yang mengaktifkan Synckerja Order. Dipakai policy foto menu. Tidak diekspos sebagai RPC.';

REVOKE ALL ON FUNCTION ops_private.synckerja_order_activated_org_ids() FROM PUBLIC;
GRANT USAGE ON SCHEMA ops_private TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ops_private.synckerja_order_activated_org_ids() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS catalog_product_photos_public_synckerja_order_menu ON storage.objects;
CREATE POLICY catalog_product_photos_public_synckerja_order_menu
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT ops_private.synckerja_order_activated_org_ids()
    )
  );

REVOKE ALL ON FUNCTION public.synckerja_order_activated_org_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.synckerja_order_activated_org_ids() TO service_role;

NOTIFY pgrst, 'reload schema';
