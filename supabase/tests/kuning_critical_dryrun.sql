-- Uji iris fungsi kuning. Satu transaksi, diakhiri ROLLBACK.
-- Menjalankan salinan migration 20261104140000 dan 20261104150000, lalu memeriksa.
-- Tidak menyisakan perubahan. Jangan hapus ROLLBACK.
-- Jangan panggil ai_employee_dispatch.
-- Komentar "jangan jalankan ulang" di dalam salinan berlaku untuk file migration, bukan untuk uji ini.
-- Bila sebuah pernyataan gagal, jalankan ROLLBACK sebelum mencoba lagi.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Penjaga organisasi aktif pada profiles.
-- Production sudah mencatat versi 20261104140000 dengan statement kosong.
-- File ini menyalin fungsi dan trigger yang hidup, supaya database baru
-- dan repo sama. Jangan jalankan ulang di production yang sudah punya versi ini.
-- Menjalankan ulang tetap aman: CREATE OR REPLACE dan DROP TRIGGER IF EXISTS.
-- Rollback: supabase/rollback/20261104_profiles_active_org_guard_rollback.sql

CREATE OR REPLACE FUNCTION public.profiles_enforce_active_org_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.active_organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.active_organization_id IS NOT DISTINCT FROM OLD.active_organization_id THEN
    RETURN NEW;
  END IF;
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = NEW.user_id
      AND uo.organization_id = NEW.active_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'active_organization_not_member'
      USING ERRCODE = '42501',
            DETAIL = 'active_organization_id must be an organization the user belongs to.';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.profiles_enforce_active_org_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_enforce_active_org_membership() TO service_role;

DROP TRIGGER IF EXISTS profiles_enforce_active_org_membership ON public.profiles;
CREATE TRIGGER profiles_enforce_active_org_membership
  BEFORE INSERT OR UPDATE OF active_organization_id
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_active_org_membership();

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

DO $test$
DECLARE
  v_member uuid;
  v_own uuid;
  v_other uuid;
  v_other_user uuid;
  v_email text;
  v_json json;
  v_bool boolean;
  v_n integer;
  v_public bigint;
  v_private bigint;
  v_policy text;
  v_body text;
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'is_blibli_seller_chat_connected',
    'is_linkedin_content_connected',
    'is_tiktok_ads_connected',
    'is_tiktok_ads_integration_enabled',
    'is_tiktok_content_connected',
    'is_youtube_content_connected'
  ]
  LOOP
    IF has_function_privilege('anon', format('public.%I(uuid)', v_name)::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon masih bisa %', v_name;
    END IF;
    IF NOT has_function_privilege('authenticated', format('public.%I(uuid)', v_name)::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'anggota kehilangan %', v_name;
    END IF;
    IF has_function_privilege('authenticated', format('public.%I(uuid)', v_name || '__impl')::regprocedure, 'EXECUTE')
       OR has_function_privilege('anon', format('public.%I(uuid)', v_name || '__impl')::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'badan asli % terbuka', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY ARRAY[
    'public.apply_meta_session_expired_conversations()',
    'public.apply_template_followup_customer_reply(uuid,uuid)',
    'public.apply_template_followup_sent(uuid,uuid)',
    'public.ensure_open_threads_conversation_cycle(uuid,uuid)',
    'public.process_due_flow_delay_jobs(integer)',
    'public.purge_expired_google_ads_metrics_cache()',
    'public.run_bank_expense_mutation_match_for_org(uuid)'
  ]
  LOOP
    IF has_function_privilege('authenticated', v_name::regprocedure, 'EXECUTE')
       OR has_function_privilege('anon', v_name::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'bukan service_role masih bisa %', v_name;
    END IF;
    IF NOT has_function_privilege('service_role', v_name::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role kehilangan %', v_name;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.profiles_enforce_active_org_membership()'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.profiles_enforce_active_org_membership()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'trigger profil masih bisa dipanggil sebagai RPC';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'profiles_enforce_active_org_membership' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trigger profil tidak ada';
  END IF;

  IF has_function_privilege('anon', 'public.pos_finalize_qris_checkout(uuid,uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pos_finalize_qris_checkout(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'pos_finalize terbuka untuk klien';
  END IF;
  SELECT p.prosrc INTO v_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'pos_finalize_qris_checkout';
  IF position('FROM public.pos_pending_checkouts' IN v_body) = 0
     OR position('v_pending.organization_id' IN v_body) = 0 THEN
    RAISE EXCEPTION 'pos_finalize tidak mengunci baris pending';
  END IF;

  IF has_function_privilege('anon', 'public.synckerja_order_activated_org_ids()'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.synckerja_order_activated_org_ids()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC daftar org masih terbuka';
  END IF;
  IF NOT has_function_privilege('anon', 'ops_private.synckerja_order_activated_org_ids()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'tamu tidak bisa membaca id untuk foto menu';
  END IF;
  SELECT count(*) INTO v_public FROM public.synckerja_order_activated_org_ids();
  SELECT count(*) INTO v_private FROM ops_private.synckerja_order_activated_org_ids();
  IF v_public IS DISTINCT FROM v_private THEN
    RAISE EXCEPTION 'daftar org storage tidak sama';
  END IF;
  SELECT pg_get_expr(pol.polqual, pol.polrelid) INTO v_policy
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage'
    AND c.relname = 'objects'
    AND pol.polname = 'catalog_product_photos_public_synckerja_order_menu';
  IF v_policy NOT LIKE '%ops_private.synckerja_order_activated_org_ids%' THEN
    RAISE EXCEPTION 'policy foto menu belum pindah';
  END IF;

  IF NOT has_function_privilege('anon', 'public.email_exists(text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'email_exists tertutup untuk pendaftaran';
  END IF;

  SELECT uo.user_id, uo.organization_id INTO v_member, v_own
  FROM public.user_organizations uo
  WHERE coalesce(uo.is_active, true)
    AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = uo.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_organizations x
        WHERE x.user_id = uo.user_id
          AND x.organization_id = o.id
          AND coalesce(x.is_active, true)
      )
    )
  LIMIT 1;
  IF v_member IS NULL THEN
    SELECT uo.user_id, uo.organization_id INTO v_member, v_own
    FROM public.user_organizations uo
    WHERE coalesce(uo.is_active, true)
    LIMIT 1;
  END IF;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'tidak ada anggota organisasi untuk uji';
  END IF;
  SELECT o.id INTO v_other
  FROM public.organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = v_member
      AND uo.organization_id = o.id
      AND coalesce(uo.is_active, true)
  )
  LIMIT 1;
  IF v_other IS NULL THEN
    v_other := gen_random_uuid();
  END IF;

  SELECT u.email INTO v_email
  FROM auth.users u
  WHERE u.id = v_member AND u.email IS NOT NULL;
  SELECT u.id INTO v_other_user
  FROM auth.users u
  WHERE u.id <> v_member AND u.email IS NOT NULL
  LIMIT 1;
  IF v_other_user IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'tidak ada dua user untuk uji token';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_bool := public.is_tiktok_ads_connected(v_own);
  IF v_bool IS NULL THEN
    RAISE EXCEPTION 'anggota tidak mendapat status koneksi';
  END IF;
  v_bool := public.is_tiktok_content_connected(v_own);
  BEGIN
    PERFORM public.is_tiktok_ads_connected(v_other);
    RAISE EXCEPTION 'organisasi lain masih terbaca';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles
    SET active_organization_id = v_other
    WHERE user_id = v_member;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'organisasi luar diterima pada profil' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'uji trigger tidak mengenai baris profil' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN NULL;
  END;

  UPDATE public.profiles
  SET active_organization_id = v_own
  WHERE user_id = v_member;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'anggota tidak bisa mengisi organisasinya';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other_user::text, true);
  v_json := public.get_latest_signup_verification_token(v_member, v_email);
  IF v_json->>'error' IS DISTINCT FROM 'not_authorized' OR v_json->>'token' IS NOT NULL THEN
    RAISE EXCEPTION 'sesi lain masih mendapat token daftar';
  END IF;
  v_json := public.issue_new_verification_token(v_email);
  IF v_json->>'error' IS DISTINCT FROM 'not_authorized' OR v_json->>'token' IS NOT NULL THEN
    RAISE EXCEPTION 'sesi lain masih menerbitkan token';
  END IF;
  v_json := public.ensure_registration_profile(v_member, v_email);
  IF v_json->>'error' IS DISTINCT FROM 'not_authorized' OR v_json->>'ok' = 'true' THEN
    RAISE EXCEPTION 'sesi lain masih menulis profil';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  EXECUTE 'SET LOCAL ROLE anon';
  v_json := public.get_latest_signup_verification_token(gen_random_uuid(), 'nobody-kuning@example.com');
  IF v_json->>'error' IS DISTINCT FROM 'no_matching_user' THEN
    RAISE EXCEPTION 'pendaftaran tanpa sesi tidak lagi menjawab user tidak ada';
  END IF;
  v_json := public.issue_new_verification_token('nobody-kuning@example.com');
  IF v_json->>'error' IS DISTINCT FROM 'user_not_found' OR v_json->>'token' IS NOT NULL THEN
    RAISE EXCEPTION 'email tanpa akun masih menerbitkan token';
  END IF;
  PERFORM public.email_exists('nobody-kuning@example.com');
  BEGIN
    PERFORM public.synckerja_order_activated_org_ids();
    RAISE EXCEPTION 'anon menjalankan RPC daftar org' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  EXECUTE 'RESET ROLE';
END;
$test$;

ROLLBACK;
