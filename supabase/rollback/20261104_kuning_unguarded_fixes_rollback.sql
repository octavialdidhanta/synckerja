-- Rollback 20261104150000_kuning_unguarded_fixes.sql.
-- Bukan migration. Jalankan di SQL Editor. Mengembalikan grant seperti keadaan
-- sebelum iris kuning: anon bisa memanggil status koneksi dan RPC daftar org.

BEGIN;

-- A. Lepas pembungkus koneksi.
DROP FUNCTION public.is_blibli_seller_chat_connected(uuid);
ALTER FUNCTION public.is_blibli_seller_chat_connected__impl(uuid) RENAME TO is_blibli_seller_chat_connected;
GRANT EXECUTE ON FUNCTION public.is_blibli_seller_chat_connected(uuid) TO anon, authenticated, service_role;

DROP FUNCTION public.is_linkedin_content_connected(uuid);
ALTER FUNCTION public.is_linkedin_content_connected__impl(uuid) RENAME TO is_linkedin_content_connected;
GRANT EXECUTE ON FUNCTION public.is_linkedin_content_connected(uuid) TO anon, authenticated, service_role;

DROP FUNCTION public.is_tiktok_ads_connected(uuid);
ALTER FUNCTION public.is_tiktok_ads_connected__impl(uuid) RENAME TO is_tiktok_ads_connected;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_connected(uuid) TO anon, authenticated, service_role;

DROP FUNCTION public.is_tiktok_ads_integration_enabled(uuid);
ALTER FUNCTION public.is_tiktok_ads_integration_enabled__impl(uuid) RENAME TO is_tiktok_ads_integration_enabled;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_integration_enabled(uuid) TO anon, authenticated, service_role;

DROP FUNCTION public.is_tiktok_content_connected(uuid);
ALTER FUNCTION public.is_tiktok_content_connected__impl(uuid) RENAME TO is_tiktok_content_connected;
GRANT EXECUTE ON FUNCTION public.is_tiktok_content_connected(uuid) TO anon, authenticated, service_role;

DROP FUNCTION public.is_youtube_content_connected(uuid);
ALTER FUNCTION public.is_youtube_content_connected__impl(uuid) RENAME TO is_youtube_content_connected;
GRANT EXECUTE ON FUNCTION public.is_youtube_content_connected(uuid) TO anon, authenticated, service_role;

-- B. Kembalikan EXECUTE authenticated pada fungsi kerja.
GRANT EXECUTE ON FUNCTION public.apply_meta_session_expired_conversations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_template_followup_customer_reply(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_template_followup_sent(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_due_flow_delay_jobs(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_google_ads_metrics_cache() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) TO authenticated, service_role;

-- C. Badan token daftar sebelum cek sesi.
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

  INSERT INTO public.profiles (user_id, email)
  VALUES (v_id, COALESCE(v_email, ''))
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN json_build_object('ok', true);
END;
$function$;

-- D. Kembalikan RPC publik daftar org dan policy foto menu.
CREATE OR REPLACE FUNCTION public.synckerja_order_activated_org_ids()
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

GRANT EXECUTE ON FUNCTION public.synckerja_order_activated_org_ids() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS catalog_product_photos_public_synckerja_order_menu ON storage.objects;
CREATE POLICY catalog_product_photos_public_synckerja_order_menu
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.synckerja_order_activated_org_ids()
    )
  );

DROP FUNCTION IF EXISTS ops_private.synckerja_order_activated_org_ids();
REVOKE USAGE ON SCHEMA ops_private FROM anon, authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
